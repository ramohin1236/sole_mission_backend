import crypto from 'crypto';

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
 * Protects backup routes by validating a secret key passed via:
 * 1. Query parameters (?secret=... or ?key=...)
 * 2. Header 'x-backup-secret'
 * 3. 'Authorization' header ('Bearer <secret>' or raw token)
 *
 * Compares against process.env.BACKUP_SECRET (or process.env.CRON_SECRET for Vercel Cron).
 */
export const verifyBackupAuth = (req, res, next) => {
  const configuredSecrets = [
    process.env.BACKUP_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean);

  if (configuredSecrets.length === 0) {
    console.error('Backup Authorization Error: BACKUP_SECRET is not configured in environment variables.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: BACKUP_SECRET is not configured.',
    });
  }

  // Extract secret from query parameters or headers
  const querySecret = req.query.secret || req.query.key;
  const headerSecret = req.headers['x-backup-secret'];
  const authHeader = req.headers['authorization'];
  const bearerSecret = authHeader
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : null;

  const providedSecret = (querySecret || headerSecret || bearerSecret || '').trim();

  if (!providedSecret) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing backup secret key. Pass via ?secret= query param, x-backup-secret header, or Authorization header.',
    });
  }

  const isAuthorized = configuredSecrets.some((validSecret) =>
    safeCompare(providedSecret, validSecret)
  );

  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid backup secret key.',
    });
  }

  next();
};

