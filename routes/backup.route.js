import express from 'express';
import {
  generateBackup,
  getBackupHistory,
} from '../controllers/backup.controller.js';
import {
  verifyBackupAuth,
  verifyBackupHistoryAuth,
} from '../middlewares/backupAuth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/backup/history
 * @desc    Fetch the latest 50 backup logs, sorted by newest first
 * @access  Protected (Requires Admin JWT or BACKUP_SECRET)
 */
router.get('/history', verifyBackupHistoryAuth, getBackupHistory);

/**
 * @route   GET /api/backup
 * @desc    Fetch essential MongoDB data, format to JSON, email as attachment, and record BackupLog
 * @access  Protected (Requires BACKUP_SECRET or CRON_SECRET)
 */
router.get('/', verifyBackupAuth, generateBackup);

export default router;
