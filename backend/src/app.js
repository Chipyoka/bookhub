import express from 'express';
import cors from 'cors'; // import cors
import { pool } from './config/db.js';
import bookRoutes from './routes/bookRoutes.js';

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
app.use('/api/books', bookRoutes); 
// All book routes will now be under /api/books

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
