import express from 'express';
import { generateBackup } from '../controllers/backup.controller.js';
import { verifyBackupAuth } from '../middlewares/backupAuth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/cron/backup
 * @route   POST /api/cron/backup
 * @desc    Failsafe external cron trigger for automated database backup.
 *          Accepts secret via ?secret=... query param, x-cron-secret / x-backup-secret header,
 *          or Authorization: Bearer <secret> header.
 * @access  Protected (Requires CRON_SECRET or BACKUP_SECRET)
 */
router.route('/backup')
  .get(verifyBackupAuth, generateBackup)
  .post(verifyBackupAuth, generateBackup);

export default router;
