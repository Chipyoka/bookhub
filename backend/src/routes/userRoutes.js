import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../config/db.js";

const router = express.Router();

// Secret key (store in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || "bookhub_secret_key";

// ==================================
// REGISTER USER
// ==================================
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, phone, address } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0)
      return res.status(400).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (full_name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?)",
      [full_name, email, hash, phone || null, address || null]
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ==================================
// LOGIN USER (with JWT issuance)
// ==================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" } // one week
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ==================================
// JWT AUTH MIDDLEWARE
// ==================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1]; // Bearer <token>
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// ==================================
// PROTECTED ROUTES
// ==================================
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, full_name, email, phone, address, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/orders", verifyToken, async (req, res) => {
  try {
    const [orders] = await db.query("SELECT * FROM orders WHERE user_id = ?", [req.user.id]);
    res.json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const [rows] = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ message: "Incorrect old password" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.user.id]);
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/orders/:orderId", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const [result] = await db.query(
      "DELETE FROM orders WHERE id = ? AND user_id = ?",
      [orderId, req.user.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Order not found or not yours" });

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
