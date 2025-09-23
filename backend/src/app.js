import express from 'express';
import { pool } from './config/db.js';

const app = express();
app.use(express.json());

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
