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
 * @route   POST /api/backup
 * @desc    Fetch essential MySQL data (quotes, users), format to .txt and .csv, email via Brevo REST API, and record BackupLog
 * @access  Protected (Requires BACKUP_SECRET or CRON_SECRET)
 */
router.route('/')
  .get(verifyBackupAuth, generateBackup)
  .post(verifyBackupAuth, generateBackup);

/**
 * @route   GET /api/backup/cron
 * @route   POST /api/backup/cron
 * @desc    Alternative endpoint for automated / external cron database backup
 * @access  Protected (Requires CRON_SECRET or BACKUP_SECRET)
 */
router.route('/cron')
  .get(verifyBackupAuth, generateBackup)
  .post(verifyBackupAuth, generateBackup);

export default router;
