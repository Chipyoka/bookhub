import express from 'express';
import cors from 'cors'; // import cors
import { pool } from './config/db.js';
import bookRoutes from './routes/bookRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

const app = express();

// --- Middleware ---
app.use(express.json());

// --- CORS Setup ---
app.use(cors({
  origin: '*', // Allow all origins (for development)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- Prefix Routes ---
// All book routes will now be under /api/books
app.use('/api/books', bookRoutes); 

// All user routes will now be under /api/users
app.use('/api/users', userRoutes);

// All payment routes will now be under /api/users
app.use('/api/payments', userRoutes);

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
