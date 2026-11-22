import Quote from '../models/Quote.js';
import User from '../models/User.js';
import BackupLog from '../models/BackupLog.js';
import { sendBackupEmail } from '../utils/emailService.js';

/**
 * Core database backup execution function.
 * Queries MySQL tables using mysql2/promise, formats data to .txt and .csv,
 * dispatches via Brevo REST API, and logs the result in the backup_logs table.
 *
 * @param {Object} options
 * @param {string} [options.type='manual'] - Backup trigger type: 'auto' or 'manual'
 * @returns {Promise<Object>} Backup summary and dispatch results
 */
export const executeDatabaseBackup = async ({ type = 'manual' } = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[BACKUP] Starting ${type} database backup at ${timestamp}...`);

  try {
    // 1. Fetch essential MySQL data
    const [quotes, users] = await Promise.all([
      Quote.find().sort({ createdAt: -1 }).lean(),
      User.find().lean(),
    ]);

    const sanitizedUsers = (users || []).map((u) => {
      const { password, resetPasswordOtp, resetPasswordOtpExpires, ...rest } = u;
      return rest;
    });

    const dateFileSlug = timestamp.replace(/[:.]/g, '-');
    const txtFilename = `solemission-backup-${dateFileSlug}.txt`;
    const csvFilename = `solemission-quotes-backup-${dateFileSlug}.csv`;
    const filename = `${txtFilename}, ${csvFilename}`;

    // 2. Construct structured backup object
    const backupData = {
      metadata: {
        application: 'Sole Mission Backend',
        database: 'MySQL',
        environment: process.env.NODE_ENV || 'production',
        type,
        exportedAt: timestamp,
        counts: {
          quotes: quotes.length,
          users: sanitizedUsers.length,
        },
      },
      quotes,
      users: sanitizedUsers,
    };

    // 3. Format data into formatted JSON string
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileSizeKB = (Buffer.byteLength(jsonString, 'utf8') / 1024).toFixed(2);
    const recipient = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_FROM?.trim() || process.env.EMAIL_USER?.trim() || 'bookings@solemission.ca';

    // 4. Dispatch email with .txt and .csv attachments using Brevo REST API
    const emailInfo = await sendBackupEmail({
      backupJsonString: jsonString,
      quotes,
      filename: txtFilename,
      summary: {
        quotesCount: quotes.length,
        usersCount: sanitizedUsers.length,
      },
    });

    // 5. Create BackupLog in MySQL with status 'success'
    let logDoc = null;
    try {
      logDoc = await BackupLog.create({
        type,
        status: 'success',
        filename,
        fileSize: `${fileSizeKB} KB`,
        recordsCount: {
          quotes: quotes.length,
          users: sanitizedUsers.length,
        },
        recipient,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('[BACKUP] Failed to save success BackupLog in MySQL:', logErr.message);
    }

    const summary = {
      success: true,
      message: `Database backup (${type}) generated and sent successfully to ${recipient}`,
      backupSummary: {
        filename,
        txtFilename,
        csvFilename,
        fileSizeKB: `${fileSizeKB} KB`,
        recordsCount: {
          quotes: quotes.length,
          users: sanitizedUsers.length,
        },
        recipient,
        messageId: emailInfo?.messageId,
        timestamp,
        type,
        logId: logDoc?._id || logDoc?.id,
      },
    };

    console.log(`[BACKUP SUCCESS] ${type} backup completed. Sent to ${recipient} (Quotes: ${quotes.length}, Users: ${sanitizedUsers.length})`);
    return summary;
  } catch (error) {
    console.error(`[BACKUP ERROR] ${type} backup execution failed:`, error);

    // Save BackupLog in MySQL with status 'failed'
    try {
      await BackupLog.create({
        type,
        status: 'failed',
        error: error.message,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('[BACKUP] Failed to save failure BackupLog in MySQL:', logErr.message);
    }

    throw error;
  }
};

/**
 * GET /api/backup or POST /api/backup
 * HTTP Controller for database backup.
 */
export const generateBackup = async (req, res) => {
  const type = req.backupType || 'manual';

  try {
    const result = await executeDatabaseBackup({ type });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create or email backup: ' + error.message,
    });
  }
};

/**
 * GET /api/backup/history
 * Fetches the latest 50 backup logs, sorted by newest first.
 */
export const getBackupHistory = async (req, res) => {
  try {
    const logs = await BackupLog.find().sort({ createdAt: -1 }).limit(50).lean();
    const totalCount = await BackupLog.countDocuments();

    return res.status(200).json({
      success: true,
      count: logs.length,
      totalCount,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch backup history: ' + error.message,
    });
  }
};
