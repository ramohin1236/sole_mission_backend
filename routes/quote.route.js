import express from 'express';
import {
  createQuote,
  getAllQuotes,
  getQuoteById,
  deleteQuote,
} from '../controllers/quote.controller.js';
import { validateQuoteInput } from '../middlewares/quoteValidator.js';

const router = express.Router();

router.post('/', validateQuoteInput, createQuote);
router.get('/', getAllQuotes);
router.get('/:id', getQuoteById);
router.get('/reference/:id', getQuoteById);
router.delete('/:id', deleteQuote);

export default router;
