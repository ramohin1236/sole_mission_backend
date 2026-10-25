import express from 'express';
import {
  login,
  getMe,
  getAuthStatus,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/status', getAuthStatus);

export default router;
