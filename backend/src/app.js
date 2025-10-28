import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import bookRoutes from './routes/bookRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

const app = express();

// --- CORS Setup ---
app.use(cors({
  origin: '*', // Allow all origins (for development)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- Middleware ---
// IMPORTANT: Use raw body for webhook route, JSON for all others
app.use('/api/payments/webhook', express.raw({type: 'application/json'}));
app.use(express.json()); // JSON parsing for all other routes

// --- Prefix Routes ---
app.use('/api/books', bookRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

// Health check route
app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ status: 'ok', dbTest: rows[0].result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default app;