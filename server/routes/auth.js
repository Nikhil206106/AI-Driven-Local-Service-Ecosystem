import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

// =======================
// Register
// =======================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role, businessName, serviceCategories } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = new User({
      name,
      email,
      password,
      phone,
      role: role || "customer",
    });

    await user.save();

    if (role === "vendor") {
      const vendor = new Vendor({
        user: user._id,
        businessName: businessName || name,
        serviceCategories: serviceCategories || [],
      });
      await vendor.save();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }
    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: "7d" });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =======================
// Login
// =======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }
    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// =======================
// Forgot Password
// =======================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });

    // generate reset token
    const resetToken = user.generatePasswordReset();
    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const message = `
      <h2>Password Reset Request</h2>
      <p>Hello ${user.name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <a href="${resetURL}" target="_blank">${resetURL}</a>
      <p>This link will expire in 10 minutes.</p>
    `;

    await sendEmail({
      // For demo purposes, all emails are sent to a fixed address.
      email: "bapvesupp@gmail.com",
      subject: `Password Reset for ${user.email}`,
      message,
    });

    res.json({ message: "Reset link sent to your email." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Email could not be sent, try again later." });
  }
});
// =======================
// Reset Password
// =======================
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.password = password; // auto-hashes in pre("save")
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
