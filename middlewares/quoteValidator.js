const VALID_CONDITIONS = ['light', 'daily', 'severe', 'vintage'];
const VALID_TURNAROUND = ['standard', 'rush'];
const VALID_FULFILLMENT = ['dropoff', 'mail'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10,11}$/;

export const validateQuoteInput = (req, res, next) => {
  const { brand, model, condition, services, photos, turnaround, fulfillment, contact, agreed } = req.body;

  if (!brand?.trim() || !model?.trim()) {
    return res.status(400).json({ success: false, message: 'Brand and model are required.' });
  }

  if (!VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ success: false, message: 'Invalid sneaker condition.' });
  }

  if (!Array.isArray(services) || services.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one service is required.' });
  }

  // Check at least one photo with previewUrl is provided
  const hasPhoto = photos && typeof photos === 'object' && Object.values(photos).some((p) => p && p.previewUrl);
  if (!hasPhoto) {
    return res.status(400).json({ success: false, message: 'At least one photo angle is required.' });
  }

  if (!VALID_TURNAROUND.includes(turnaround)) {
    return res.status(400).json({ success: false, message: 'Invalid turnaround option.' });
  }

  if (!VALID_FULFILLMENT.includes(fulfillment)) {
    return res.status(400).json({ success: false, message: 'Invalid fulfillment method.' });
  }

  if (!contact || typeof contact !== 'object') {
    return res.status(400).json({ success: false, message: 'Contact information is required.' });
  }

  if (!contact.fullName || contact.fullName.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters.' });
  }

  const cleanPhone = String(contact.phone || '').replace(/\D/g, '');
  if (!PHONE_REGEX.test(cleanPhone)) {
    return res.status(400).json({ success: false, message: 'Phone must be a valid 10 or 11 digit number.' });
  }

  if (!contact.email || !EMAIL_REGEX.test(contact.email.trim())) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  if (agreed !== true) {
    return res.status(400).json({ success: false, message: 'You must agree to the terms.' });
  }

  next();
};
