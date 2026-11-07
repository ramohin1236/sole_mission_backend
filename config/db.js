import mongoose from 'mongoose';

/**
 * Global connection cache for serverless environments (Vercel)
 * and long-running Node servers.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  // If already connected (readyState 1), return cached connection immediately
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If a connection promise is not already in flight, create one
  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(mongoUri, opts)
      .then((m) => {
        console.log('MongoDB connected successfully');
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        console.error('MongoDB connection error:', err.message);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
};

export default connectDB;

