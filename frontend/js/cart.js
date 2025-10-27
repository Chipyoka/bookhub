// ============================
// cart.js — Bookhub E-commerce
// Works for both view-book.html and checkout.html
// ============================

// ---------- Helpers ----------
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ---------- Cart Utilities ----------
function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getAllTotalItems() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// ---------- Add to Cart ----------
function addToCart(book) {
  let cart = getCart();

  const existing = cart.find((item) => item.id === book.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...book, qty: 1 });
  }

  saveCart(cart);
  alert(`${book.title} added to cart`);
  renderCart();
  updateCartBadge();
}

// ---------- Remove Item ----------
function removeFromCart(id) {
  let cart = getCart().filter((item) => item.id !== id);
  saveCart(cart);
  renderCart();
  updateCartBadge();
}

// ---------- Update Quantity ----------
function updateQuantity(id, change) {
  let cart = getCart();
  const item = cart.find((b) => b.id === id);
  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      cart = cart.filter((b) => b.id !== id);
    }
    saveCart(cart);
    renderCart();
    updateCartBadge();
  }
}

// ---------- Render Cart ----------
function renderCart() {
  const list = document.querySelector(".cart-list");
  if (!list) return;

  const cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = "<p>Your cart is empty.</p>";
    const totalDiv = document.getElementById("cart-total-amount");
    if (totalDiv) totalDiv.innerHTML = "";
    return;
  }

  list.innerHTML = cart
    .map(
      (item) => `
      <div class="cart-item">
        <img src="${item.image_url}" alt="${item.title}" width="60">
        <div class="cart-info">
            <div class="details"> 
                <div> 
                    <p><strong>${item.title}</strong></p>
                    <p class="price">Unit Price: K${Number(item.price).toFixed(2)}</p>
                </div>
                <div class="qty-controls">
                    <button class="btn-qty" onclick="updateQuantity(${item.id}, -1)">−</button>
                    <span class="qty">${item.qty}</span>
                    <button class="btn-qty" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
            <div class="summary">
                <p>Subtotal: <span class="subtotal">K${(item.price * item.qty).toFixed(2)}</span></p>
                <button class="btn-remove" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        </div>
      </div>
    `
    )
    .join("");

  const total = getCartTotal();
  const totalDiv = document.getElementById("cart-total-amount");
  if (totalDiv) {
    totalDiv.className = "cart-total";
    totalDiv.innerHTML = `<h3>Cart Total: K${total.toFixed(2)}</h3>`;
  }
}

// ---------- Clear Cart ----------
function clearCart() {
  localStorage.removeItem("cart");
  renderCart();
  updateCartBadge();
}

// ---------- Cart Badge ----------
function updateCartBadge() {
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = getAllTotalItems();

  const totalItems = document.getElementById("total-items");
  if (totalItems) {
    totalItems.innerHTML = `<h3>Total Items: ${getAllTotalItems()}</h3>`;
  }
}

// ---------- Page Initialization ----------
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ Cart or Checkout Pages
  if (document.querySelector(".cart-list")) {
    renderCart();
  }

  // 2️⃣ Book Details Page
  const addBtn = document.getElementById("add-to-cart-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const book = {
        id: Number(getQueryParam("id")),
        title: document.getElementById("book-title").textContent,
        price: parseFloat(document.getElementById("book-price").textContent),
        image_url: document.getElementById("book-image").src,
      };
      addToCart(book);
    });
  }

  // Always update badge
  updateCartBadge();
});

// ---------- Expose Global Functions ----------
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.getAllTotalItems = getAllTotalItems;
window.getCartTotal = getCartTotal;
window.getCart = getCart;
window.clearCart = clearCart;
