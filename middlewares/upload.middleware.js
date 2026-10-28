import multer from 'multer';
import { uploadToCloudinary } from '../config/cloudinary.js';

// Multer setup with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    file.mimetype?.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('INVALID_IMAGE_TYPE'), false);
  },
});

// Error response handler
const sendError = (err, res) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Image size exceeds 10MB! Please upload an image under 10MB.',
    });
  }
  if (err.message === 'INVALID_IMAGE_TYPE') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (jpg, jpeg, png, webp, gif) are allowed.',
    });
  }
  return res.status(400).json({ success: false, message: err.message });
};

// Single image upload middleware
export const uploadSingle = (field = 'image', folder = 'solemission') => (req, res, next) => {
  upload.single(field)(req, res, async (err) => {
    if (err) return sendError(err, res);
    if (!req.file) return next();

    try {
      const { secure_url, public_id } = await uploadToCloudinary(req.file.buffer, folder);
      req.file.url = secure_url;
      req.file.public_id = public_id;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

// Multiple images upload middleware
export const uploadMultiple = (field = 'images', max = 5, folder = 'solemission') => (req, res, next) => {
  upload.array(field, max)(req, res, async (err) => {
    if (err) return sendError(err, res);
    if (!req.files?.length) return next();

    try {
      await Promise.all(
        req.files.map(async (file) => {
          const { secure_url, public_id } = await uploadToCloudinary(file.buffer, folder);
          file.url = secure_url;
          file.public_id = public_id;
        })
      );
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

export const uploadSingleImage = uploadSingle;
export const uploadMultipleImages = uploadMultiple;
