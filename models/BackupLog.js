import mongoose from 'mongoose';

const backupLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['auto', 'manual'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    filename: {
      type: String,
      default: null,
    },
    fileSize: {
      type: String,
      default: null,
    },
    recordsCount: {
      quotes: { type: Number, default: 0 },
      users: { type: Number, default: 0 },
    },
    recipient: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('BackupLog', backupLogSchema);

