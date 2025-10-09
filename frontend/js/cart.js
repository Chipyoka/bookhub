// cart.js — works for both view-book.html and checkout.html

// Helper for URL param
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ========== Utility ==========
function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// ========== Add to Cart ==========
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
  renderCart(); // refresh UI if on checkout page
  updateCartBadge(); // <--- update badge live
}

// ========== Remove from Cart ==========
function removeFromCart(id) {
  let cart = getCart().filter((item) => item.id !== id);
  saveCart(cart);
  renderCart();
  updateCartBadge(); // <--- update badge live
}

// ========== Update Quantity ==========
function updateQuantity(id, change) {
  let cart = getCart();
  const item = cart.find((b) => b.id === id);
  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      // remove if 0 or below
      cart = cart.filter((b) => b.id !== id);
    }
    saveCart(cart);
    renderCart();
    updateCartBadge(); // <--- update badge live
  }
}



// ========== Render Cart ==========
function renderCart() {
  const list = document.querySelector(".cart-list");
  if (!list) return;

  const cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = "<p>Your cart is empty.</p>";
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
                <p >Subtotal: <span class="subtotal"> K${(item.price * item.qty).toFixed(2)}</span></p>
                <button class="btn-remove" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        </div>
      </div>
    `
    )
    .join("");

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalDiv = document.getElementById("cart-total-amount");
  totalDiv.className = "cart-total";
  totalDiv.innerHTML = `<h3>Cart Total: K${total.toFixed(2)}</h3>`;
  
}



// ========== Clear Cart ==========
function clearCart() {
  localStorage.removeItem("cart");
  renderCart();
  alert("Thank you for your purchase!");
}

// ========== Initialization ==========
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ Checkout Page
  if (document.querySelector(".cart-list")) {
    renderCart();

    const checkoutForm = document.querySelector(".checkout-form form");
    if (checkoutForm) {
      checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        clearCart();
        checkoutForm.reset();
      });
    }
  }

  // 2️⃣ View Book Page
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
});

// Function to get total items in cart
function getAllTotalItems() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

// Update the cart count badge
function updateCartBadge() {
    const badge = document.getElementById("cart-count");
    if (badge) {
        badge.textContent = getAllTotalItems();
    }
    // Returns total number of items in the cart
    const totalItems = document.getElementById("total-items");
    if (totalItems) {
        totalItems.innerHTML = `<h3>Total Items: ${getAllTotalItems()}</h3>`;
    }
}

// Call this on page load
document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
});











// expose it to inline HTML
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.getAllTotalItems = getAllTotalItems;