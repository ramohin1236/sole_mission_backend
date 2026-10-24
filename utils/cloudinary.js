/**
 * Central Cloudinary & Upload exports
 * All functions & middlewares can be accessed from here
 */
export { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
export { uploadSingle, uploadMultiple } from '../middlewares/upload.middleware.js';

// Backward compatibility aliases
export { uploadSingle as uploadSingleImage, uploadMultiple as uploadMultipleImages } from '../middlewares/upload.middleware.js';
