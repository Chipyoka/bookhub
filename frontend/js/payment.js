// ==============================
// payment.js — Bookhub Payments
// Handles payments for payment.html
// ==============================

// ---------- Elements ----------
const orderDetailsDiv = document.getElementById("order-details");
const feedbackDiv = document.getElementById("payment-feedback");
const cardButton = document.getElementById("card-button");
const gpayButton = document.getElementById("gpay-button");
const paymentPage = document.getElementById("payment-page");

// ---------- Configuration ----------
// const API_BASE_URL = window.location.hostname === 'localhost' 
//     ? 'http://localhost:5000/api' 
//     : '/api'; 

const API_BASE_URL = 'http://localhost:5000/api' 

// ---------- Load Pending Order ----------
const pendingOrder = JSON.parse(localStorage.getItem("pendingOrder"));
const user = JSON.parse(localStorage.getItem("user")); // Assuming user is stored in localStorage

paymentPage.style.display = "none";

if (!pendingOrder || !user) {
    if (!user) {
        alert("Please log in to complete your purchase");
        window.location.href = "login.html";
    } else {
        alert("No pending order found. Please go back to checkout.");
        window.location.href = "checkout.html";
    }
} else {
    paymentPage.style.display = "flex";
    const { cart, shipping, totalAmount } = pendingOrder;

    orderDetailsDiv.innerHTML = `
        <div class="shipping-info">
            <p class="label"> Shipping To: </p>
            <p class="shipping-to"> <span>Name | </span>${shipping.name}</p>
            <p class="shipping-to-addr"><span>Phone | </span>${shipping.phone || '-'}</p>
            <p class="shipping-to-addr"><span>Address | </span>${shipping.address}</p>
            <p class="shipping-to"><span>Total Order Amount | </span>K${totalAmount.toFixed(2)}</p>
        </div>
        <div class="order-items">
            <p class="label"> Order Items: </p>
            <div class="items">
             ${cart.map(i => `     
                    <div class="item">
                        <div class="image"> <img src="${i.image_url}" alt="${i.title}" /> </div>
                        <div class="info"> ${i.title} (QTY: ${i.qty}) <br/> <strong>K${(i.price).toFixed(2)}</strong> </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ---------- Stripe Setup ----------
const stripe = Stripe("pk_test_51SMy7QHI5XWKcgyz7ywlfRAvNSZwXedxniwhkme2mjbPjUFhOhTZixkOhp3vxTruzIgvjCsSNDz675JSBQAaB2jX007wgJSNlU");

// ---------- Payment Processing ----------
async function processPayment(method) {
    if (!pendingOrder || !user) return;

    feedbackDiv.textContent = `Processing payment via ${method}...`;
    feedbackDiv.style.color = "blue";
    feedbackDiv.style.borderColor = "blue";

    try {
        // Prepare cart items for backend
        const cartItems = pendingOrder.cart.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.qty,
            image_url: item.image_url
        }));

        // Create checkout session with backend
        const response = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cartItems: cartItems,
                paymentMethod: method.toLowerCase(),
                user: {
                    id: user.id,
                    full_name: user.full_name || user.name,
                    email: user.email
                },
                shipping: pendingOrder.shipping
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to create checkout session');
        }

        // Store session ID for verification later
        localStorage.setItem('currentSessionId', result.data.sessionId);
        localStorage.setItem('pendingOrder', JSON.stringify({
            ...pendingOrder,
            sessionId: result.data.sessionId
        }));

        // Redirect to Stripe Checkout
        window.location.href = result.data.url;

    } catch (error) {
        console.error("Payment error:", error);
        feedbackDiv.textContent = `Payment error: ${error.message}`;
        feedbackDiv.style.color = "red";
        feedbackDiv.style.borderColor = "red";
    }
}

// ---------- Check for Returning from Stripe ----------
function checkReturnFromStripe() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const isSuccess = window.location.pathname.includes('success.html');
    const isCancel = window.location.pathname.includes('cancel.html');

    if (sessionId) {
        if (isSuccess) {
            verifyPaymentSuccess(sessionId);
        } else if (isCancel) {
            handlePaymentCancellation(sessionId);
        }
    }
}

// ---------- Verify Payment Success ----------
async function verifyPaymentSuccess(sessionId) {
    try {
        feedbackDiv.textContent = "Verifying your payment...";
        feedbackDiv.style.color = "blue";
        feedbackDiv.style.borderColor = "blue";

        const response = await fetch(`${API_BASE_URL}/payments/verify-session?session_id=${sessionId}`);
        const result = await response.json();

        if (result.success && result.session_payment_status === 'paid') {
            // Payment successful
            feedbackDiv.textContent = "Payment successful! Thank you for your order.";
            feedbackDiv.style.color = "green";
            feedbackDiv.style.borderColor = "green";

            // Save completed order to localStorage
            const completedOrders = JSON.parse(localStorage.getItem("completedOrders") || "[]");
            completedOrders.push({
                ...pendingOrder,
                paidAt: new Date().toISOString(),
                paymentMethod: 'stripe',
                orderId: result.order_id,
                sessionId: sessionId
            });
            localStorage.setItem("completedOrders", JSON.stringify(completedOrders));

            // Clear pending order
            localStorage.removeItem("pendingOrder");
            localStorage.removeItem('currentSessionId');

            // Redirect to success page after 2 seconds
            setTimeout(() => {
                window.location.href = "orders.html";
            }, 2000);

        } else {
            throw new Error('Payment verification failed');
        }
    } catch (error) {
        console.error("Verification error:", error);
        feedbackDiv.textContent = "Payment verification failed. Please check your orders page.";
        feedbackDiv.style.color = "orange";
        feedbackDiv.style.borderColor = "orange";
    }
}

// ---------- Handle Payment Cancellation ----------
async function handlePaymentCancellation(sessionId) {
    try {
        feedbackDiv.textContent = "Payment was cancelled. You can try again.";
        feedbackDiv.style.color = "orange";
        feedbackDiv.style.borderColor = "orange";

        // Verify the session was actually cancelled
        const response = await fetch(`${API_BASE_URL}/payments/check-session?session_id=${sessionId}`);
        const result = await response.json();

        if (result.success) {
            console.log('Session cancellation confirmed:', result.session);
        }

        // Clear session ID but keep pending order for retry
        localStorage.removeItem('currentSessionId');

    } catch (error) {
        console.error("Cancellation handling error:", error);
    }
}

// ---------- Check if we're on a callback page ----------
if (window.location.pathname.includes('success.html') || window.location.pathname.includes('cancel.html')) {
    checkReturnFromStripe();
}

// ---------- Event Listeners ----------
cardButton.addEventListener("click", () => processPayment("card"));
gpayButton.addEventListener("click", () => processPayment("card")); // Google Pay also goes through Stripe

// ---------- Utility Functions ----------
function showLoading() {
    feedbackDiv.textContent = "Processing...";
    feedbackDiv.style.color = "blue";
    feedbackDiv.style.borderColor = "blue";
    cardButton.disabled = true;
    gpayButton.disabled = true;
}

function hideLoading() {
    cardButton.disabled = false;
    gpayButton.disabled = false;
}

// Add loading states to buttons
cardButton.addEventListener('click', showLoading);
gpayButton.addEventListener('click', showLoading);