import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendPasswordResetOtpEmail } from '../utils/emailService.js';

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

    const token = generateToken(user.id || user._id, user.email, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id || user._id,
        _id: user._id || String(user.id),
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
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id || user._id,
        _id: user._id || String(user.id),
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

/**
 * @desc    Send OTP to email for password reset / update
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
export const sendPasswordResetOtp = async (req, res) => {
  try {
    const email = req.body.email || req.user?.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user account found with this email address.',
      });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving to database
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save hashed OTP with 10-minute validity
    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send the OTP via email
    await sendPasswordResetOtpEmail({
      email: user.email,
      otp,
      name: user.name,
    });

    return res.status(200).json({
      success: true,
      message: 'OTP has been sent to your email. Please check your inbox.',
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP to email.',
      error: error.message,
    });
  }
};

/**
 * @desc    Verify OTP code
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOtp = async (req, res) => {
  try {
    const email = req.body.email || req.user?.email;
    const { otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Both email and 6-digit OTP code are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP request found. Please request a new code.',
      });
    }

    // Check expiration
    if (new Date() > new Date(user.resetPasswordOtpExpires)) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new code.',
      });
    }

    // Compare hashed OTP
    const isMatch = await bcrypt.compare(String(otp).trim(), user.resetPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please check and try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying OTP.',
      error: error.message,
    });
  }
};

/**
 * @desc    Reset or update password using OTP
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const email = req.body.email || req.user?.email;
    const { otp, newPassword, password } = req.body;
    const finalPassword = newPassword || password;

    if (!email || !otp || !finalPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required.',
      });
    }

    if (finalPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP request found. Please request a new code.',
      });
    }

    // Check expiration
    if (new Date() > new Date(user.resetPasswordOtpExpires)) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new code.',
      });
    }

    // Validate OTP
    const isMatch = await bcrypt.compare(String(otp).trim(), user.resetPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Password was not updated.',
      });
    }

    // Hash new password and save
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(finalPassword, salt);

    // Invalidate the OTP so it cannot be reused
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been updated successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating password.',
      error: error.message,
    });
  }
};

/**
 * @desc    Change password directly for logged-in user
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while changing password.',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all users (excluding passwords and OTP fields)
 * @route   GET /api/auth/users
 * @access  Private/Admin
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();

    const sanitizedUsers = users.map((u) => {
      const { password, resetPasswordOtp, resetPasswordOtpExpires, ...rest } = u;
      return rest;
    });

    return res.status(200).json({
      success: true,
      count: sanitizedUsers.length,
      data: sanitizedUsers,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching users.',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a user by ID
 * @route   DELETE /api/auth/users/:id
 * @access  Private/Admin
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    const numericId = Number(id);
    const userToDelete = await User.findById(numericId);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Prevent admin from deleting their own logged-in account
    const loggedInId = req.user ? (req.user.id || req.user._id) : null;
    if (loggedInId && String(loggedInId) === String(id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
    }

    // If deleting an admin, ensure at least one admin remains in the system
    if (userToDelete.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only remaining admin account.',
        });
      }
    }

    await User.findByIdAndDelete(numericId);

    return res.status(200).json({
      success: true,
      message: `User ${userToDelete.email} has been deleted successfully.`,
      deletedUserId: id,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting user.',
      error: error.message,
    });
  }
};
