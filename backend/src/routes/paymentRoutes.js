// paymentRoutes.js
import express from 'express';
import { pool } from '../config/db.js';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Nodemailer transporter using Gmail app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // email address
    pass: process.env.GMAIL_APP_PASSWORD // Gmail App Password
  }
});

/**
 * Middleware: ensure user is provided in request body
 * NOTE: frontend should include user object (id, full_name, email) in the body.
 */
const ensureUser = (req, res, next) => {
  const user = req.body.user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: 'User must be logged in' });
  }
  req.user = user;
  next();
};

/**
 * Helper: send order email
 */
const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: process.env.GMAIL_FROM,
    to,
    subject,
    html
  };
  return transporter.sendMail(mailOptions);
};

/**
 * POST /api/payments/create-checkout-session
 * - Creates order, order_items, payment (pending), logs (order placed)
 * - Creates Stripe Checkout Session and returns session.url
 * Transactional: all DB inserts are in a transaction to avoid partial state.
 */
router.post('/create-checkout-session', ensureUser, async (req, res) => {
  const { cartItems = [], paymentMethod = 'stripe' } = req.body;

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  let connection;
  try {
    // calculate total
    const totalAmount = cartItems.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);

    // start transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1) create order (status pending)
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [req.user.id, totalAmount, 'pending']
    );
    const orderId = orderResult.insertId;

    // 2) insert order items
    const orderItemsValues = cartItems.map(item => [orderId, item.id, item.quantity, item.price]);
    if (orderItemsValues.length > 0) {
      await connection.query(
        'INSERT INTO order_items (order_id, book_id, quantity, price) VALUES ?',
        [orderItemsValues]
      );
    }

    // 3) create payment record (pending) - use uuid as transaction_reference
    const transactionRef = uuidv4();
    const [paymentResult] = await connection.query(
      'INSERT INTO payments (user_id, order_id, amount, method, status, transaction_reference) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, orderId, totalAmount, paymentMethod, 'pending', transactionRef]
    );
    const paymentId = paymentResult.insertId;

    // 4) insert log: order placed (pending payment)
    const logDetails = `Order ${orderId} created with payment ${paymentId}, amount ${totalAmount}`;
    await connection.query(
      'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'Order Created', logDetails]
    );

    // commit DB transaction (order/payment created)
    await connection.commit();

    // 5) create Stripe checkout session (outside DB transaction)
    const lineItems = cartItems.map(item => ({
      price_data: {
        currency: process.env.STRIPE_CURRENCY || 'usd',
        product_data: { name: item.title || item.name || `Book #${item.id}` },
        unit_amount: Math.round(Number(item.price) * 100)
      },
      quantity: Number(item.quantity)
    }));

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel.html?session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'google_pay'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: String(orderId),
        paymentId: String(paymentId),
        userId: String(req.user.id)
      }
    });

    // 6) send "Order placed (pending payment)" email to user
    try {
      const itemsHtml = cartItems.map(i => `<li>${i.title || i.name || `Book ${i.id}`} — ${i.quantity} x $${Number(i.price).toFixed(2)}</li>`).join('');
      const emailHtml = `
        <p>Hi ${req.user.full_name || ''},</p>
        <p>Thank you — we have created your order (ID: <strong>${orderId}</strong>). It is pending payment.</p>
        <p><strong>Order summary:</strong></p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total:</strong> $${Number(totalAmount).toFixed(2)}</p>
        <p>Please complete payment using the Checkout page. If successful, you will receive a confirmation email.</p>
      `;
      await sendEmail({ to: req.user.email, subject: `Order #${orderId} placed — pending payment`, html: emailHtml });
    } catch (emailErr) {
      console.error('Failed to send order placed email:', emailErr?.message || emailErr);
      // non-fatal — do not rollback
    }

    return res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (err) {
    console.error('create-checkout-session error:', err?.message || err);
    // rollback if connection in transaction
    try {
      if (connection) await connection.rollback();
    } catch (rbErr) {
      console.error('Rollback error:', rbErr?.message || rbErr);
    }
    return res.status(500).json({ success: false, message: 'Server error creating checkout session' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * POST /api/payments/webhook
 * Uses express.raw in server to receive raw body. Make sure app does not json-parse this route.
 * This updates payments/orders, writes logs, and sends confirmation/cancellation emails.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // handle relevant events
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const paymentStripeIntent = session.payment_intent; // Stripe PaymentIntent id
      const orderId = metadata.orderId;
      const paymentId = metadata.paymentId;
      const userId = metadata.userId;

      // Use DB transaction to update payments/orders and log
      let connection;
      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1) update payments - status to completed, store stripe intent in transaction_reference (or update existing)
        await connection.query(
          'UPDATE payments SET status = ?, transaction_reference = ? WHERE id = ?',
          ['completed', paymentStripeIntent || null, paymentId]
        );

        // 2) update orders - status = paid
        await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);

        // 3) insert log
        await connection.query(
          'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
          [userId || null, 'Payment Completed', `Stripe intent ${paymentStripeIntent} completed for order ${orderId}, payment ${paymentId}`]
        );

        // 4) commit
        await connection.commit();

        // 5) fetch order, user, and items to include in confirmation email
        const [[userRow]] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [userId]);
        const [[orderRow]] = await pool.query('SELECT id, total_amount FROM orders WHERE id = ?', [orderId]);
        const [itemsRows] = await pool.query(
          `SELECT oi.quantity, oi.price, b.title
           FROM order_items oi
           LEFT JOIN books b ON b.id = oi.book_id
           WHERE oi.order_id = ?`,
          [orderId]
        );

        // build email
        if (userRow && userRow.email) {
          const itemsHtml = itemsRows.map(it => `<li>${it.title || 'Book'} — ${it.quantity} x $${Number(it.price).toFixed(2)}</li>`).join('');
          const emailHtml = `
            <p>Hi ${userRow.full_name || ''},</p>
            <p>Your payment for order <strong>#${orderId}</strong> has been successfully processed.</p>
            <p><strong>Order details:</strong></p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total Paid:</strong> $${Number(orderRow.total_amount).toFixed(2)}</p>
            <p>Thank you for shopping with us. We will notify you once your order ships.</p>
          `;
          try {
            await sendEmail({ to: userRow.email, subject: `Order #${orderId} confirmed`, html: emailHtml });
          } catch (emailErr) {
            console.error('Failed to send confirmation email:', emailErr?.message || emailErr);
          }
        }

      } catch (dbErr) {
        console.error('DB error handling checkout.session.completed:', dbErr?.message || dbErr);
        try { if (connection) await connection.rollback(); } catch (rbe) { console.error('Rollback err', rbe?.message || rbe); }
      } finally {
        if (connection) connection.release();
      }

    } else if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
      // session expired or intent failed -> mark payment as failed and order cancelled (or keep pending based on business rule)
      // retrieve metadata from event (if payment_intent.* may carry reference)
      const session = event.data.object;
      const metadata = session?.metadata || {};
      const paymentId = metadata?.paymentId;
      const orderId = metadata?.orderId;
      const userId = metadata?.userId;

      let connection;
      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // mark payment failed
        if (paymentId) {
          await connection.query('UPDATE payments SET status = ? WHERE id = ?', ['failed', paymentId]);
        }
        // mark order cancelled (you can choose 'pending' instead if you want manual retry)
        if (orderId) {
          await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
        }

        // insert log
        await connection.query(
          'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
          [userId || null, 'Payment Failed/Expired', `Payment ${paymentId || 'N/A'} for order ${orderId || 'N/A'} failed or expired`]
        );

        await connection.commit();

        // send cancellation notification email (if user exists)
        if (userId) {
          const [[userRow]] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [userId]);
          if (userRow && userRow.email) {
            const emailHtml = `
              <p>Hi ${userRow.full_name || ''},</p>
              <p>We were unable to process payment for your order <strong>#${orderId}</strong>. The order has been cancelled.</p>
              <p>You can retry placing your order from your cart. If you need help, reply to this email.</p>
            `;
            try {
              await sendEmail({ to: userRow.email, subject: `Order #${orderId} — Payment Failed`, html: emailHtml });
            } catch (emailErr) {
              console.error('Failed to send payment failed email:', emailErr?.message || emailErr);
            }
          }
        }

      } catch (dbErr) {
        console.error('DB error handling failed/expired session:', dbErr?.message || dbErr);
        try { if (connection) await connection.rollback(); } catch (rbe) { console.error('Rollback err', rbe?.message || rbe); }
      } finally {
        if (connection) connection.release();
      }
    } else {
      // For other event types you might want to handle or ignore
      // console.log(`Unhandled event type ${event.type}`);
    }

    // Acknowledge receipt of the event
    res.json({ received: true });
  } catch (err) {
    console.error('General webhook handler error:', err?.message || err);
    return res.status(500).send();
  }
});

/**
 * GET /api/payments/verify-session?session_id=...
 * Called by success.html to verify Stripe session and retrieve DB order info if available.
 */
router.get('/verify-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ success: false, message: 'session_id required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const metadata = session.metadata || {};
    const orderId = metadata.orderId;
    const paymentId = metadata.paymentId;

    // Prefer DB truth: fetch payment/order rows
    if (orderId) {
      const [orderRows] = await pool.query('SELECT id, user_id, total_amount, status, created_at FROM orders WHERE id = ?', [orderId]);
      const order = orderRows[0] || null;
      const [paymentRows] = await pool.query('SELECT id, amount, method, status, transaction_reference FROM payments WHERE id = ?', [paymentId]);
      const payment = paymentRows[0] || null;

      return res.json({
        success: true,
        session_payment_status: session.payment_status,
        order_id: order?.id || null,
        amount: order ? Number(order.total_amount).toFixed(2) : (session.amount_total ? (session.amount_total / 100).toFixed(2) : null),
        order_status: order?.status || null,
        payment: payment || null
      });
    }

    // if no metadata/orderId, still return session info
    return res.json({
      success: true,
      session_payment_status: session.payment_status,
      amount: session.amount_total ? (session.amount_total / 100).toFixed(2) : null
    });
  } catch (err) {
    console.error('verify-session error:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
});

/**
 * GET /api/payments/check-session?session_id=...
 * Called by cancel.html to quickly check session existence.
 */
router.get('/check-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ success: false, message: 'session_id required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    return res.json({ success: true, exists: !!session, session });
  } catch (err) {
    console.error('check-session error:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
});


/**
 * POST /api/payments/test-email
 * Test endpoint for sending emails via Postman
 * This allows you to verify email configuration without going through payment flow
 */
router.post('/test-email', async (req, res) => {
  const { to, subject, html, testType = 'custom' } = req.body;

  // Default test data if not provided
  const testTo = to || process.env.GMAIL_USER; // Send to yourself if no recipient specified
  const testSubject = subject || `Test Email - ${new Date().toISOString()}`;
  
  let testHtml = html;
  
  if (!testHtml) {
    if (testType === 'order-confirmation') {
      testHtml = `
        <h2>Order Confirmation Test</h2>
        <p>Hi Test User,</p>
        <p>Your order <strong>#TEST-123</strong> has been confirmed!</p>
        <p><strong>Order summary:</strong></p>
        <ul>
          <li>Book Title 1 — 2 x $29.99</li>
          <li>Book Title 2 — 1 x $19.99</li>
        </ul>
        <p><strong>Total: $79.97</strong></p>
        <p>Thank you for your purchase!</p>
      `;
    } else if (testType === 'order-placed') {
      testHtml = `
        <h2>Order Placed Test</h2>
        <p>Hi Test User,</p>
        <p>Thank you — we have created your order (ID: <strong>TEST-456</strong>). It is pending payment.</p>
        <p><strong>Order summary:</strong></p>
        <ul>
          <li>Test Book — 1 x $25.00</li>
        </ul>
        <p><strong>Total: $25.00</strong></p>
        <p>Please complete payment using the Checkout page.</p>
      `;
    } else if (testType === 'payment-failed') {
      testHtml = `
        <h2>Payment Failed Test</h2>
        <p>Hi Test User,</p>
        <p>We were unable to process payment for your order <strong>#TEST-789</strong>.</p>
        <p>The order has been cancelled. You can retry placing your order from your cart.</p>
      `;
    } else {
      testHtml = `
        <h2>Test Email</h2>
        <p>This is a test email sent from your payment system.</p>
        <p>Time sent: ${new Date().toString()}</p>
        <p>If you're reading this, your email configuration is working correctly!</p>
      `;
    }
  }

  try {
    // Test transporter verification first
    await transporter.verify();
    console.log('Email transporter verified successfully');

    // Send test email
    const info = await sendEmail({
      to: testTo,
      subject: testSubject,
      html: testHtml
    });

    console.log('Test email sent successfully:', info.messageId);
    
    return res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId,
      recipient: testTo,
      subject: testSubject
    });
    
  } catch (error) {
    console.error('Test email failed:', error?.message || error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error?.message || error,
      details: {
        gmailUser: process.env.GMAIL_USER ? 'Set' : 'Not set',
        gmailFrom: process.env.GMAIL_FROM ? 'Set' : 'Not set',
        gmailAppPassword: process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Not set'
      }
    });
  }
});


export default router;
