import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { getPool, connectDB } from './config/db.js';
import uploadRoutes from './routes/upload.route.js';
import quoteRoutes from './routes/quote.route.js';
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/user.route.js';
import backupRoutes from './routes/backup.route.js';
import cronRoutes from './routes/cron.route.js';
import { executeDatabaseBackup } from './controllers/backup.controller.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sole-mission-gules.vercel.app',
  'https://sole-mission.mohinr26.workers.dev',
  'https://solemission.ca',
  'https://www.solemission.ca',
  'https://sole-mission.solemission905.workers.dev',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Default / Health check route
app.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'success',
    message: `Sole Mission Backend server is running on port ${PORT}`,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Diagnostic health check route with detailed DB status
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;

  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    server: 'running',
    database: {
      status: dbStatus,
      state: dbStatus === 'connected' ? 'connected' : 'disconnected',
      hostConfigured: Boolean(process.env.DB_HOST),
      databaseConfigured: Boolean(process.env.DB_NAME),
      error: dbError,
    },
    timestamp: new Date().toISOString(),
  });
});

// Middleware: Ensure database is connected before handling any API routes
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      next();
    } catch (err) {
      console.error('Database connection error on API request:', err.message);
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please ensure MySQL database is running and environment variables are configured.',
        error: err.message,
      });
    }
  } else {
    next();
  }
});

// Application Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/cron', cronRoutes);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload received.',
    });
  }
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// Daily midnight automated database backup cron job
// Schedule: Every day at 00:00 (midnight) explicitly in America/Toronto timezone
const CRON_SCHEDULE = '0 0 * * *';
const CRON_TIMEZONE = 'America/Toronto';

console.log(`[CRON INIT] Initializing automated daily database backup job on schedule: "${CRON_SCHEDULE}" (Timezone: ${CRON_TIMEZONE})`);

cron.schedule(
  CRON_SCHEDULE,
  async () => {
    const timestampToronto = new Date().toLocaleString('en-US', { timeZone: CRON_TIMEZONE });
    console.log(`⏰ [CRON START] Triggering automated daily database backup at ${timestampToronto} (${CRON_TIMEZONE})...`);

    try {
      const result = await executeDatabaseBackup({ type: 'auto' });
      console.log(`✅ [CRON SUCCESS] Automated daily database backup succeeded at ${timestampToronto}:`, result?.message);
    } catch (cronErr) {
      console.error(`❌ [CRON ERROR] Automated daily database backup failed at ${timestampToronto}:`, cronErr.message);
    }
  },
  {
    scheduled: true,
    timezone: CRON_TIMEZONE,
  }
);
console.log(`[CRON READY] Automated database backup scheduled successfully for ${CRON_TIMEZONE}.`);

// Start Server
const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Initial MySQL connection error:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();

export default app;
