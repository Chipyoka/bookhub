// paymentRoutes.js
import express from 'express';
import { pool } from '../config/db.js';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Middleware: ensure user is provided in request body
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
 * POST /api/payments/create-checkout-session
 * Creates an order, payment record, and Stripe checkout session
 */
router.post('/create-checkout-session', ensureUser, async (req, res) => {
  const { cartItems, paymentMethod } = req.body;

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  try {
    // --- 1. Calculate total ---
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    // --- 2. Create order ---
    const [orderResult] = await pool.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [req.user.id, totalAmount, 'pending']
    );
    const orderId = orderResult.insertId;

    // --- 3. Insert order items ---
    const orderItemsValues = cartItems.map(item => [orderId, item.id, item.quantity, item.price]);
    await pool.query(
      'INSERT INTO order_items (order_id, book_id, quantity, price) VALUES ?',
      [orderItemsValues]
    );

    // --- 4. Create payment record ---
    const transactionRef = uuidv4();
    const [paymentResult] = await pool.query(
      'INSERT INTO payments (user_id, order_id, amount, method, status, transaction_reference) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, orderId, totalAmount, paymentMethod, 'pending', transactionRef]
    );
    const paymentId = paymentResult.insertId;

    // --- 5. Create Stripe Checkout Session ---
    const lineItems = cartItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.title },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.quantity
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'google_pay'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/payment-cancel`,
      metadata: {
        orderId: orderId.toString(),
        paymentId: paymentId.toString()
      }
    });

    res.json({ success: true, data: { url: session.url } });

  } catch (err) {
    console.error('Error creating checkout session:', err.message);
    res.status(500).json({ success: false, message: 'Server error creating checkout session' });
  }
});

/**
 * POST /api/payments/webhook
 * Handles Stripe webhook events for payment success/failure
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

  const metadata = event.data.object.metadata;
  const paymentId = metadata.paymentId;
  const orderId = metadata.orderId;

  try {
    if (event.type === 'checkout.session.completed') {
      await pool.query('UPDATE payments SET status = ? WHERE id = ?', ['completed', paymentId]);
      await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);
      await pool.query(
        'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
        [null, 'Payment Completed', `Payment ${paymentId} for order ${orderId} completed via Stripe`]
      );
    } else if (
      event.type === 'checkout.session.expired' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      await pool.query('UPDATE payments SET status = ? WHERE id = ?', ['failed', paymentId]);
      await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['pending', orderId]);
      await pool.query(
        'INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)',
        [null, 'Payment Failed', `Payment ${paymentId} for order ${orderId} failed`]
      );
    }
  } catch (err) {
    console.error('Error handling webhook update:', err.message);
  }

  res.json({ success: true, message: 'Webhook received' });
});

export default router;
