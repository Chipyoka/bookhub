const API_URL = "http://localhost:5000/api/users"; // Adjust if your backend is on a different path

// =======================
// HELPER FUNCTIONS
// =======================
function getToken() {
  return localStorage.getItem("authToken");
}

function getUser() {
  return JSON.parse(localStorage.getItem("user"));
}

function setUser(user, token) {
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("authToken", token);
}

function clearUser() {
  localStorage.removeItem("user");
  localStorage.removeItem("authToken");
}

// Display messages
function showMessage(msg, success = false) {
  const messageDiv = document.getElementById("message");
  if (!messageDiv) return;
  messageDiv.style.color = success ? "green" : "red";
  messageDiv.textContent = msg;
  setTimeout(() => { messageDiv.textContent = ""; }, 4000);
}

// =======================
// AUTO-REDIRECT IF ALREADY LOGGED IN
// =======================
function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.href = "profile.html";
  }
}

// Auto-redirect from profile.html if not logged in
function redirectIfNotLoggedIn() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

// =======================
// REGISTER
// =======================
async function registerUser() {
  const full_name = document.getElementById("full_name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const phone = document.getElementById("phone")?.value.trim() || "";
  const address = document.getElementById("address")?.value.trim() || "";

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, password, phone, address })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(data.message, true);
      setTimeout(() => { window.location.href = "login.html"; }, 1500);
    } else {
      showMessage(data.message);
    }
  } catch (err) {
    console.error(err);
    showMessage("Failed to register. Try again.");
  }
}

// =======================
// LOGIN
// =======================
async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user, data.token);
      showMessage("Login successful!", true);
      setTimeout(() => { window.location.href = "profile.html"; }, 1000);
    } else {
      showMessage(data.message);
    }
  } catch (err) {
    console.error(err);
    showMessage("Login failed. Try again.");
  }
}

// =======================
// LOAD PROFILE
// =======================
async function loadProfile() {
  redirectIfNotLoggedIn();

  try {
    const res = await fetch(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (!res.ok) {
      clearUser();
      window.location.href = "login.html";
      return;
    }

    // Populate profile info
    const infoDiv = document.getElementById("profileInfo");
    if (infoDiv) {
      infoDiv.innerHTML = `
        <div class="pname"> 
            <h3> ${data.full_name}</h3>
            <p> ${data.email}</p>
        </div>
        <p><strong>Phone:</strong> ${data.phone || "-"}</p>
        <p><strong>Address:</strong> ${data.address || "-"}</p>
        <p><strong>Joined:</strong> ${new Date(data.created_at).toLocaleDateString()}</p>
      `;
    }
  } catch (err) {
    console.error(err);
    clearUser();
    window.location.href = "login.html";
  }
}

// =======================
// CHANGE PASSWORD
// =======================
async function changePassword() {
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;

  if (!oldPassword || !newPassword) {
    showMessage("Both old and new passwords are required.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(data.message, true);
      document.getElementById("changePasswordForm").reset();
    } else {
      showMessage(data.message);
    }
  } catch (err) {
    console.error(err);
    showMessage("Failed to change password.");
  }
}


// =======================
// LOAD USER ORDERS
// =======================
async function loadOrders() {
  const ordersDiv = document.getElementById("ordersList");
  if (!ordersDiv) return;

  try {
    const res = await fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const orders = await res.json();
    console.log("My Orders:", orders);

    if (!res.ok) {
      ordersDiv.innerHTML = "<p>No orders found.</p>";
      return;
    }

    if (orders.length === 0) {
      ordersDiv.innerHTML = "<p>No orders placed yet.</p>";
      return;
    }

    // Generate HTML for each order
    ordersDiv.innerHTML = orders.map(order => {
      const itemsList = order.items?.map(item => `
        <li>${item.book_name} (x${item.quantity}) - K${item.price}</li>
      `).join("") || "";

      const paymentMethod = order.payment?.method || "N/A";
      const datePlaced = new Date(order.created_at).toLocaleString();

      return `
        <div class="order-card">
        <p class="order-status ${order.status === 'paid' ? 'g' : 'p'}"> ${order.status}</p>
          <p class="order-id"><strong>Order ID:</strong> ${order.id}</p>
          <p class="order-date"><strong> Date:</strong><br/> ${datePlaced}</p>
          <div class="order-summary"> 
            <p class="order-payment"><strong>Payment:</strong><br/> ${paymentMethod}</p>
            <p class="order-total"><strong>Total:</strong><br/> K${order.total_amount}</p>
          </div>
          <p class="order-items"><strong>${order.items?.length || 0} Items:</strong></p>
          <ul>${itemsList?.length ? itemsList : "<li class='no-items'>No items found</li>"}</ul>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    ordersDiv.innerHTML = "<p>Failed to load orders.</p>";
  }
}


// =======================
// LOGOUT
// =======================
function logoutUser() {
  clearUser();
  window.location.href = "login.html";
}

// =======================
// PAGE INITIALIZATION
// =======================

// If this script runs on login.html or register.html, redirect logged-in users
if (document.body.contains(document.getElementById("loginForm")) ||
    document.body.contains(document.getElementById("registerForm"))) {
  redirectIfLoggedIn();
}

// If this script runs on profile.html, load profile automatically
if (document.body.contains(document.getElementById("profileInfo"))) {
  loadProfile();
  loadOrders();
}
