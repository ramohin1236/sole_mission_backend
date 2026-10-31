import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 */
const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

/**
 * Extracts secret token from request query params or headers.
 */
const extractProvidedSecret = (req) => {
  const querySecret = req.query.secret || req.query.key;
  const headerSecret = req.headers['x-backup-secret'];
  const authHeader = req.headers['authorization'];
  const bearerSecret = authHeader
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : null;

  return (querySecret || headerSecret || bearerSecret || '').trim();
};

/**
 * Protects backup execution routes by validating a secret key:
 * 1. Query parameters (?secret=... or ?key=...)
 * 2. Header 'x-backup-secret'
 * 3. 'Authorization' header ('Bearer <secret>')
 *
 * Distinguishes whether the authorization used CRON_SECRET ('auto') or BACKUP_SECRET ('manual').
 * Attaches `req.backupType` as 'auto' or 'manual'.
 */
export const verifyBackupAuth = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const backupSecret = process.env.BACKUP_SECRET?.trim();

  const configuredSecrets = [backupSecret, cronSecret].filter(Boolean);

  if (configuredSecrets.length === 0) {
    console.error('Backup Authorization Error: Neither BACKUP_SECRET nor CRON_SECRET is configured.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: BACKUP_SECRET is not configured in environment variables.',
    });
  }

  const providedSecret = extractProvidedSecret(req);

  if (!providedSecret) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing backup secret key. Pass via ?secret= query param, x-backup-secret header, or Authorization header.',
    });
  }

  const isCronMatch = cronSecret && safeCompare(providedSecret, cronSecret);
  const isBackupMatch = backupSecret && safeCompare(providedSecret, backupSecret);

  if (!isCronMatch && !isBackupMatch) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid backup secret key.',
    });
  }

  // Determine type: 'auto' if authorized using CRON_SECRET, or if Vercel cron header is present; otherwise 'manual'
  if (isCronMatch && (!isBackupMatch || req.headers['x-vercel-cron'] || req.query.type === 'auto')) {
    req.backupType = 'auto';
  } else if (isBackupMatch) {
    req.backupType = 'manual';
  } else {
    req.backupType = 'auto';
  }

  next();
};

/**
 * Protects GET /api/backup/history.
 * Allows access if:
 * 1. Valid Admin JWT token provided in Authorization header, OR
 * 2. Valid BACKUP_SECRET or CRON_SECRET provided in headers or query params.
 */
export const verifyBackupHistoryAuth = async (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const backupSecret = process.env.BACKUP_SECRET?.trim();
  const providedSecret = extractProvidedSecret(req);

  // 1. Check if provided secret matches BACKUP_SECRET or CRON_SECRET
  if (
    providedSecret &&
    ((backupSecret && safeCompare(providedSecret, backupSecret)) ||
     (cronSecret && safeCompare(providedSecret, cronSecret)))
  ) {
    return next();
  }

  // 2. Check if a valid JWT token is provided (Admin authentication)
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'solemission_jwt_secret_default_key_2026'
      );
      const user = await User.findById(decoded.id).select('-password');
      if (user && (user.role === 'admin' || user.role === 'staff')) {
        req.user = user;
        return next();
      }
    } catch {
      // Token was not a valid JWT; fall through to 401
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Access to backup history requires admin login token or backup secret key.',
  });
};
