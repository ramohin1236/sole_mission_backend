import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import User from '../models/User.js';
import BackupLog from '../models/BackupLog.js';
import { sendBackupEmail } from '../utils/emailService.js';

/**
 * GET /api/backup
 * Generates a JSON backup of essential MongoDB collections (Quotes, Users),
 * sends it as an attachment to the admin email via Nodemailer,
 * and records a BackupLog entry with status 'success' or 'failed'.
 */
export const generateBackup = async (req, res) => {
  const type = req.backupType || 'manual';

  try {
    // Ensure MongoDB connection is active
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        return res.status(500).json({
          success: false,
          message: 'MONGODB_URI is not defined in environment variables.',
        });
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Fetch essential MongoDB collections
    const [quotes, users] = await Promise.all([
      Quote.find().sort({ createdAt: -1 }).lean(),
      User.find().select('-resetPasswordOtp -resetPasswordOtpExpires').lean(),
    ]);

    const timestamp = new Date().toISOString();
    const dateFileSlug = timestamp.replace(/[:.]/g, '-');
    const filename = `solemission-backup-${dateFileSlug}.json`;

    // Construct structured backup object
    const backupData = {
      metadata: {
        application: 'Sole Mission Backend',
        environment: process.env.NODE_ENV || 'production',
        type,
        exportedAt: timestamp,
        counts: {
          quotes: quotes.length,
          users: users.length,
        },
      },
      quotes,
      users,
    };

    // Format data into formatted JSON string
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileSizeKB = (Buffer.byteLength(jsonString, 'utf8') / 1024).toFixed(2);
    const recipient = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_USER?.trim();

    // Dispatch email with .json attachment using Nodemailer setup
    const emailInfo = await sendBackupEmail({
      backupJsonString: jsonString,
      filename,
      summary: {
        quotesCount: quotes.length,
        usersCount: users.length,
      },
    });

    // Create BackupLog in MongoDB with status 'success'
    let logDoc = null;
    try {
      logDoc = await BackupLog.create({
        type,
        status: 'success',
        filename,
        fileSize: `${fileSizeKB} KB`,
        recordsCount: {
          quotes: quotes.length,
          users: users.length,
        },
        recipient,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('Failed to save success BackupLog:', logErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Database backup (${type}) generated and sent successfully to ${recipient}`,
      backupSummary: {
        filename,
        fileSizeKB: `${fileSizeKB} KB`,
        recordsCount: {
          quotes: quotes.length,
          users: users.length,
        },
        recipient,
        messageId: emailInfo.messageId,
        timestamp,
        type,
        logId: logDoc?._id,
      },
    });
  } catch (error) {
    console.error('Backup generation error:', error);

    // Save BackupLog in MongoDB with status 'failed'
    try {
      await BackupLog.create({
        type,
        status: 'failed',
        error: error.message,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('Failed to save failure BackupLog:', logErr.message);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create or email backup: ' + error.message,
    });
  }
};

/**
 * GET /api/backup/history
 * Fetches the latest 50 backup logs from MongoDB, sorted by newest first.
 */
export const getBackupHistory = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        return res.status(500).json({
          success: false,
          message: 'MONGODB_URI is not defined in environment variables.',
        });
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const logs = await BackupLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

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
