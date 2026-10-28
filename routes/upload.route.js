import express from 'express';
import { uploadSingle, uploadMultiple } from '../middlewares/upload.middleware.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Upload Single Image (Max 10MB)
router.post('/single', uploadSingle('image', 'solemission/images'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image.' });
  }

  res.status(200).json({
    success: true,
    message: 'Image uploaded successfully!',
    data: {
      url: req.file.url,
      public_id: req.file.public_id,
    },
  });
});

// Upload Multiple Images (Max 5 images, each max 10MB)
router.post('/multiple', uploadMultiple('images', 5, 'solemission/gallery'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Please upload at least one image.' });
  }

  const images = req.files.map((file) => ({
    url: file.url,
    public_id: file.public_id,
  }));

  res.status(200).json({
    success: true,
    message: `${images.length} images uploaded successfully!`,
    data: images,
  });
});

// Delete Image from Cloudinary
router.delete('/', async (req, res) => {
  try {
    const public_id = req.body?.public_id || req.query?.public_id;
    if (!public_id) {
      return res.status(400).json({ success: false, message: 'public_id is required in body or query.' });
    }

    const result = await deleteFromCloudinary(public_id);
    res.status(200).json({ success: true, message: 'Image deleted successfully!', result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
