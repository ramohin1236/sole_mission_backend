import mongoose from 'mongoose';

const photoSlotSchema = {
  fileName: { type: String },
  previewUrl: { type: String },
  originalSize: { type: Number },
  compressedSize: { type: Number },
  status: { type: String },
};

const quoteSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    isSuede: { type: Boolean, default: false },
    condition: {
      type: String,
      enum: ['light', 'daily', 'severe', 'vintage'],
      required: true,
    },
    services: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, 'At least one service is required.'],
    },
    addOns: { type: [String], default: [] },
    photos: {
      front: photoSlotSchema,
      outer: photoSlotSchema,
      inner: photoSlotSchema,
      heel: photoSlotSchema,
      outsole: photoSlotSchema,
    },
    turnaround: {
      type: String,
      enum: ['standard', 'rush'],
      default: 'standard',
      required: true,
    },
    fulfillment: {
      type: String,
      enum: ['dropoff', 'mail'],
      required: true,
    },
    contact: {
      fullName: { type: String, required: true, minlength: 2, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      instagram: { type: String, trim: true },
    },
    agreed: { type: Boolean, required: true },
    estimate: {
      low: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      rangeFormatted: { type: String },
      basePackageName: { type: String },
    },
    tierId: { type: String, default: null },
    autoFlags: [
      {
        id: String,
        label: String,
        severity: { type: String, enum: ['warning', 'info'] },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Quote', quoteSchema);
