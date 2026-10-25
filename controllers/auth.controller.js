import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate JWT Token helper
 */
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET || 'solemission_jwt_secret_default_key_2026',
    { expiresIn: '7d' }
  );
};

/**
 * @desc    Login user. If user doesn't exist, the first 2 users to log in automatically become admin.
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists in DB
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // User exists -> compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Incorrect password.',
        });
      }
    } else {
      // User does NOT exist in DB
      // Check how many users currently exist in DB
      const userCount = await User.countDocuments();

      // Rule: The first 2 users who log in will both be admin!
      if (userCount < 2) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Derive name if not provided (e.g. from email before @)
        const emailPrefix = normalizedEmail.split('@')[0];
        const formattedName =
          name?.trim() ||
          emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

        user = await User.create({
          email: normalizedEmail,
          password: hashedPassword,
          name: formattedName,
          role: 'admin',
        });
      } else {
        // If 2 admins already exist, no new users can be registered through login
        return res.status(403).json({
          success: false,
          message:
            'Access denied. Account not found and admin slots are full (maximum 2 admins permitted).',
        });
      }
    }

    const token = generateToken(user._id, user.email, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message,
    });
  }
};

/**
 * @desc    Get currently authenticated user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error fetching user.',
      error: error.message,
    });
  }
};

/**
 * @desc    Check authentication status & available admin slots
 * @route   GET /api/auth/status
 * @access  Public
 */
export const getAuthStatus = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    const totalCount = await User.countDocuments();
    return res.status(200).json({
      success: true,
      totalUsers: totalCount,
      adminCount,
      slotsAvailable: Math.max(0, 2 - totalCount),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
