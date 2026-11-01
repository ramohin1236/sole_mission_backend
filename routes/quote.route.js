import express from 'express';
import {
  createQuote,
  getAllQuotes,
  getQuoteById,
  deleteQuote,
  updateQuoteStatus,
} from '../controllers/quote.controller.js';
import { validateQuoteInput } from '../middlewares/quoteValidator.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public: Customer submits quote from website
router.post('/', validateQuoteInput, createQuote);

// Admin Only: Single and All Quotes retrieval, Update & Delete
router.get('/', protect, adminOnly, getAllQuotes);
router.get('/:id', protect, adminOnly, getQuoteById);
router.get('/reference/:id', protect, adminOnly, getQuoteById);
router.patch('/:id/status', protect, adminOnly, updateQuoteStatus);
router.put('/:id/status', protect, adminOnly, updateQuoteStatus);
router.patch('/:id', protect, adminOnly, updateQuoteStatus);
router.put('/:id', protect, adminOnly, updateQuoteStatus);
router.delete('/:id', protect, adminOnly, deleteQuote);

export default router;
