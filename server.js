import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import uploadRoutes from './routes/upload.route.js';
import quoteRoutes from './routes/quote.route.js';
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/user.route.js';
import backupRoutes from './routes/backup.route.js';

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
app.get('/', (req, res) => {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'success',
    message: `Sole Mission Backend server is running on port ${PORT}`,
    database: readyStates[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Diagnostic health check route with detailed DB status
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;

  try {
    await connectDB();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }

  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    server: 'running',
    database: {
      status: dbStatus,
      state: readyStates[mongoose.connection.readyState] || mongoose.connection.readyState,
      uriConfigured: Boolean(process.env.MONGODB_URI),
      error: dbError,
    },
    timestamp: new Date().toISOString(),
  });
});

// Middleware: Ensure database is connected before handling any API routes
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('Database connection error on API request:', err.message);
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please ensure MongoDB Atlas Network Access (0.0.0.0/0) and MONGODB_URI are configured.',
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

// Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose disconnected from MongoDB');
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Initial MongoDB connection error:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();

export default app;
