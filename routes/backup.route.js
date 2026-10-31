import express from 'express';
import { generateBackup } from '../controllers/backup.controller.js';
import { verifyBackupAuth } from '../middlewares/backupAuth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/backup
 * @desc    Fetch essential MongoDB data, format to JSON, and email as attachment
 * @access  Protected (Requires BACKUP_SECRET via query param or headers)
 */
router.get('/', verifyBackupAuth, generateBackup);

export default router;

