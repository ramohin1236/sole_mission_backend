import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import User from '../models/User.js';
import { sendBackupEmail } from '../utils/emailService.js';

/**
 * GET /api/backup
 * Generates a JSON backup of essential MongoDB collections (Quotes, Users)
 * and sends it as an attachment to the admin email via Nodemailer.
 */
export const generateBackup = async (req, res) => {
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

    // Dispatch email with .json attachment using Nodemailer setup
    const emailInfo = await sendBackupEmail({
      backupJsonString: jsonString,
      filename,
      summary: {
        quotesCount: quotes.length,
        usersCount: users.length,
      },
    });

    const recipient = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_USER?.trim();

    return res.status(200).json({
      success: true,
      message: `Database backup generated and sent successfully to ${recipient}`,
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
      },
    });
  } catch (error) {
    console.error('Backup generation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create or email backup: ' + error.message,
    });
  }
};

