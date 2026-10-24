import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import uploadRoutes from './routes/upload.route.js';
import quoteRoutes from './routes/quote.route.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://sole-mission-gules.vercel.app',
  'https://sole-mission.mohinr26.workers.dev',
  'https://solemission.ca',
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Default / Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: `Sole Mission Backend server is running on port ${PORT}`,
    timestamp: new Date().toISOString(),
  });
});

// Application Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/quotes', quoteRoutes);

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.warn('MONGODB_URI is not defined in .env');
      return;
    }
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};

// Start Server
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  await connectDB();
});
