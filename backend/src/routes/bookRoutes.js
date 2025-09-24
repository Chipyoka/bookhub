import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

/**
 * GET /books
 * Fetch books with optional filters and pagination
 * Query params:
 *  search: string
 *  category: string
 *  author: string
 *  startDate: YYYY-MM-DD
 *  endDate: YYYY-MM-DD
 *  priceMin: number
 *  priceMax: number
 *  page: number (default 1)
 *  limit: number (default 10)
 */
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      author,
      startDate,
      endDate,
      priceMin,
      priceMax,
      page = 1,
      limit = 8,
    } = req.query;

    let query = 'SELECT * FROM books WHERE 1=1';
    const params = [];

    // --- Filters ---
    if (search) {
      query += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ?)';
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (author) {
      query += ' AND author = ?';
      params.push(author);
    }

    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    if (priceMin) {
      query += ' AND price >= ?';
      params.push(priceMin);
    }

    if (priceMax) {
      query += ' AND price <= ?';
      params.push(priceMax);
    }

    // --- Count total for pagination ---
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) AS temp`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // --- Pagination ---
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      data: rows,
    });
  } catch (err) {
    console.error('Error fetching books:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /books/:id
 * Fetch a single book by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Error fetching book by ID:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// GET /api/books/search?q=keyword
router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  const [rows] = await pool.query(
    `SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY created_at DESC`,
    [`%${q}%`, `%${q}%`]
  );
  res.json({ success: true, data: rows });
});


export default router;
