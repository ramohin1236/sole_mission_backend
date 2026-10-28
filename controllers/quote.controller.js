import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import { generateUniqueReference } from '../utils/referenceGenerator.js';
import { sendQuoteNotifications, sendQuoteCancellationEmail } from '../utils/emailService.js';

// 1. Submit Quote
export const createQuote = async (req, res) => {
  try {
    const reference = await generateUniqueReference();
    const payload = { ...req.body };
    if (payload.estimate?.low && payload.estimate?.high && (!payload.estimate.rangeFormatted || payload.estimate.rangeFormatted.includes('৳'))) {
      payload.estimate.rangeFormatted = `$${payload.estimate.low} - $${payload.estimate.high} CAD`;
    }

    const quote = await Quote.create({ ...payload, reference, status: 'pending' });
    await sendQuoteNotifications(quote).catch((err) => console.error('Email notification error:', err.message));
    res.status(201).json({ success: true, message: 'Quote submitted successfully', reference, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get All Quotes (Pagination, Filter, Search)
export const getAllQuotes = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, condition, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (condition) filter.condition = condition;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ reference: regex }, { 'contact.fullName': regex }, { 'contact.email': regex }, { 'contact.phone': regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await Promise.all([
      Quote.countDocuments(filter),
      Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    ]);

    res.status(200).json({ success: true, total, page: pageNum, totalPages: Math.ceil(total / limitNum), data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Single Quote (By MongoDB _id or Reference)
export const getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const quote = isObjectId ? await Quote.findById(id) : await Quote.findOne({ reference: id });

    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found.' });
    res.status(200).json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Delete Quote (and send cancellation email to customer)
export const deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const deleted = isObjectId
      ? await Quote.findByIdAndDelete(id)
      : await Quote.findOneAndDelete({ reference: id });

    if (!deleted) return res.status(404).json({ success: false, message: 'Quote not found.' });

    // Send cancellation email if customer email exists
    if (deleted.contact?.email) {
      await sendQuoteCancellationEmail(deleted).catch((err) =>
        console.error('Cancellation email notification error:', err.message)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Quote cancelled/deleted successfully, and notification email sent to customer.',
      reference: deleted.reference,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
