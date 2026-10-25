import express from 'express';
import {
  login,
  getMe,
  getAuthStatus,
  sendPasswordResetOtp,
  verifyOtp,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/status', getAuthStatus);

// OTP-based Password Reset & Update
router.post('/send-otp', sendPasswordResetOtp);
router.post('/forgot-password', sendPasswordResetOtp);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/update-password', resetPassword);

// Logged-in user direct password change
router.put('/change-password', protect, changePassword);

export default router;
