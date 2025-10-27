// ==============================
// payment.js — Bookhub Payments
// Handles payments for payment.html
// ==============================

// import { getCart, getCartTotal, clearCart } from './cart.js';

// ---------- Elements ----------
const orderDetailsDiv = document.getElementById("order-details");
const feedbackDiv = document.getElementById("payment-feedback");
const cardButton = document.getElementById("card-button");
const gpayButton = document.getElementById("gpay-button");

// ---------- Load Pending Order ----------
const pendingOrder = JSON.parse(localStorage.getItem("pendingOrder"));

if (!pendingOrder) {
  orderDetailsDiv.innerHTML = "<p>No pending order found. Please go back to checkout.</p>";
} else {
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
                    <div class="image"> <img src=${i.image_url} alt=${i.title} /> </div>
                    <div class="info"> ${i.title} (QTY: ${i.qty}) <br/> <strong>K${(i.price).toFixed(2)}</strong> </div>
                </div>
            `).join('')}
        </div>
    </div>
  `;
}

// ---------- Stripe Setup ----------
const stripe = Stripe("pk_test_YOUR_STRIPE_PUBLIC_KEY"); // Replace with your test key

// ---------- Payment Processing ----------
async function processPayment(method) {
  if (!pendingOrder) return;

  feedbackDiv.textContent = `Processing payment via ${method}...`;
  feedbackDiv.style.color = "blue";

  try {
    // ---------- Simulated Payment ----------
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isSuccess = true; // set false to simulate failure

    if (isSuccess) {
      feedbackDiv.textContent = "Payment successful! Thank you for your order.";
      feedbackDiv.style.color = "green";

      // Save completed order
      const completedOrders = JSON.parse(localStorage.getItem("completedOrders") || "[]");
      completedOrders.push({
        ...pendingOrder,
        paidAt: new Date().toISOString(),
        paymentMethod: method
      });
      localStorage.setItem("completedOrders", JSON.stringify(completedOrders));

      // Clear cart and pending order
      clearCart();
      localStorage.removeItem("pendingOrder");
    } else {
      feedbackDiv.textContent = "Payment failed. Please try again.";
      feedbackDiv.style.color = "red";
    }

  } catch (error) {
    console.error("Payment error:", error);
    feedbackDiv.textContent = "An error occurred during payment. Please try again.";
    feedbackDiv.style.color = "red";
  }
}

// ---------- Event Listeners ----------
cardButton.addEventListener("click", () => processPayment("Card"));
gpayButton.addEventListener("click", () => processPayment("Google Pay"));
