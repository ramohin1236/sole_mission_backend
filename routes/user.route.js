import express from 'express';
import { getAllUsers, deleteUser } from '../controllers/auth.controller.js';
import { protect, adminOnly } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private/Admin
 */
router.get('/', protect, adminOnly, getAllUsers);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user by ID
 * @access  Private/Admin
 */
router.delete('/:id', protect, adminOnly, deleteUser);

export default router;

