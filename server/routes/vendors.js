import express from 'express';
import Vendor from '../models/Vendor.js';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'vendor-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Default images for services
const CATEGORY_IMAGES = {
  plumbing: ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800'],
  electrical: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800'],
  cleaning: ['https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80&w=800'],
  painting: ['https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=800'],
  carpentry: ['https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=800'],
  'appliance-repair': ['https://images.unsplash.com/photo-1581092921461-eab62e97a782?auto=format&fit=crop&q=80&w=800'],
  hvac: ['https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800'],
  landscaping: ['https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&q=80&w=800'],
  moving: ['https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&q=80&w=800'],
  'pest-control': ['https://images.unsplash.com/photo-1587574293340-e0011c4e8ecf?auto=format&fit=crop&q=80&w=800'],
  handyman: ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800'],
};
const DEFAULT_IMAGE = ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800'];

// ===============================
// Middleware: Check Vendor Verification
// ===============================
const checkVendorVerification = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    if (vendor.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        error: `Access Forbidden. Vendor not verified (Status: ${vendor.verificationStatus})`,
        status: vendor.verificationStatus
      });
    }

    req.vendor = vendor;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Verification check failed.' });
  }
};

// ===============================
// Get Vendor Profile
// ===============================
router.get(
  '/profile',
  authenticateToken,
  authorizeRole(['vendor']),
  async (req, res) => {
    try {
      const vendor = await Vendor.findOne({ user: req.user._id })
        .populate('user', '-password')
        .populate('services');

      if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
      res.json(vendor);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ===============================
// Update Vendor Profile
// ===============================
router.put(
  '/profile',
  authenticateToken,
  authorizeRole(['vendor']),
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'identityProof', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        businessName,
        experience,
        serviceCategories,
        description,
        cities,
        radius,
      } = req.body;

      // --- 1. Update User Document ---
      const userUpdateData = {};
      if (req.files && req.files['profilePhoto']) {
        userUpdateData.profileImage = req.files['profilePhoto'][0].path.replace(/\\/g, '/');
      }
      
      // Use the first city from the service area as the primary city for the user's address
      const primaryCity = cities ? JSON.parse(cities)[0] : undefined;

      if (req.body.street || req.body.state || req.body.zipCode) {
        userUpdateData.address = {
          street: req.body.street,
          city: primaryCity,
          state: req.body.state,
          zipCode: req.body.zipCode
        };
      }

      if (Object.keys(userUpdateData).length > 0) {
        await User.findByIdAndUpdate(req.user._id, { $set: userUpdateData });
      }

      // --- 2. Update Vendor Document ---
      const vendorUpdateData = {
        businessName,
        experience: Number(experience) || 0,
        description,
        serviceCategories: serviceCategories ? JSON.parse(serviceCategories) : [],
        'serviceArea.cities': cities ? JSON.parse(cities) : [],
        'serviceArea.radius': radius ? Number(radius) : 10,
      };

      if (req.files && req.files['identityProof']) {
        vendorUpdateData['documents.identityProof'] = req.files['identityProof'][0].path.replace(/\\/g, '/');
      }

      const vendor = await Vendor.findOneAndUpdate(
        { user: req.user._id },
        { $set: vendorUpdateData },
        { new: true }
      ).populate('user', '-password');

      if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });
      res.json(vendor);
    } catch (err) {
      console.error("Error updating vendor profile:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ===============================
// Admin: Verify Vendor & Auto-Create Default Services
// ===============================
router.post(
  '/verify/:id',
  authenticateToken,
  authorizeRole(['admin']),
  async (req, res) => {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

      // 1️⃣ Update vendor verification
      vendor.verificationStatus = 'verified';
      vendor.verifiedBy = req.user._id;
      vendor.verificationDate = new Date();
      await vendor.save();

      // 2️⃣ Check and create default services if not present
      const existingServices = await Service.find({ vendor: vendor._id });

      let insertedServices = [];
      if (existingServices.length === 0 && vendor.serviceCategories?.length > 0) {
        const defaultServices = vendor.serviceCategories.map(cat => ({
          title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Service`,
          description: `Professional ${cat.replace('-', ' ')} service by ${vendor.businessName}`,
          category: cat,
          pricing: { type: 'fixed', amount: 500, unit: 'per job' },
          images: CATEGORY_IMAGES[cat] || DEFAULT_IMAGE,
          vendor: vendor._id,
          isActive: true,
        }));

        insertedServices = await Service.insertMany(defaultServices);
        vendor.services = insertedServices.map(s => s._id);
        await vendor.save();

        console.log(`✅ Added ${insertedServices.length} default services for vendor: ${vendor.businessName}`);
      }

      // 3️⃣ Emit real-time event via Socket.IO (auto-update frontend)
      if (insertedServices.length > 0) {
        // The frontend expects populated vendor data to render the service card correctly.
        // We need to re-fetch the newly created services to populate them.
        const serviceIds = insertedServices.map(s => s._id);
        const populatedServices = await Service.find({ _id: { $in: serviceIds } })
          .populate({
            path: 'vendor',
            select: 'businessName verificationStatus user',
            populate: {
              path: 'user',
              select: 'name ratings'
            }
          });
        const { io } = await import('../index.js');
        io.emit('serviceUpdated', { vendorId: vendor._id, services: populatedServices });
      }

      // 4️⃣ Respond back
      res.json({
        message: 'Vendor verified successfully and services created (if none existed).',
        vendor,
        newServices: insertedServices
      });
    } catch (err) {
      console.error('Verification Error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);



// ===============================
// Get Vendor Bookings
// ===============================
router.get(
  '/bookings',
  authenticateToken,
  authorizeRole(['vendor']),
  checkVendorVerification,
  async (req, res) => {
    try {
      const bookings = await Booking.find({ vendor: req.vendor._id })
        .populate('customer', 'name email phone')
        .populate('service', 'title category')
        .sort({ createdAt: -1 });

      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ===============================
// Update Booking Status
// ===============================
router.patch(
  '/bookings/:bookingId/status',
  authenticateToken,
  authorizeRole(['vendor']),
  checkVendorVerification,
  async (req, res) => {
    try {
      const { status, vendorNotes } = req.body;
      // Corrected allowed statuses to match the Booking model enum.
      // A vendor can confirm, start, request completion (verification-pending), or cancel a booking.
      const allowedVendorStatuses = ['confirmed', 'in-progress', 'verification-pending', 'cancelled'];
      if (!allowedVendorStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status update. Allowed statuses are: ${allowedVendorStatuses.join(', ')}.` });
      }

      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) return res.status(404).json({ error: 'Booking not found.' });

      booking.status = status;
      booking.notes = booking.notes || {};
      if (vendorNotes) booking.notes.vendorNotes = vendorNotes;

      booking.timeline.push({
        status,
        note: vendorNotes || `Status updated to ${status}`,
      });

      await booking.save();
      res.json(booking);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ===============================
// Get Vendor Earnings
// ===============================
router.get(
  '/earnings',
  authenticateToken,
  authorizeRole(['vendor']),
  checkVendorVerification,
  async (req, res) => {
    try {
      const bookings = await Booking.find({
        vendor: req.vendor._id,
        status: 'completed',
        'pricing.paymentStatus': 'paid',
      });

      const total = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
      const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const thisMonth = bookings
        .filter(b => b.createdAt >= thisMonthStart)
        .reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);

      res.json({
        total,
        thisMonth,
        completedJobs: bookings.length,
        bookings: bookings.slice(0, 10),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ===============================
// Get Vendor Dashboard Stats
// ===============================
router.get(
  '/dashboard-stats',
  authenticateToken,
  authorizeRole(['vendor']),
  checkVendorVerification,
  async (req, res) => {
    try {
      const vendorId = req.vendor._id;

      // 1. Active Bookings
      const activeBookings = await Booking.countDocuments({
        vendor: vendorId,
        status: { $in: ['pending', 'confirmed', 'in-progress', 'verification-pending'] }
      });

      // 2. Completed Services
      const completedServices = await Booking.countDocuments({
        vendor: vendorId,
        status: 'completed'
      });

      // 3. Total Revenue
      const revenueResult = await Booking.aggregate([
        { $match: { vendor: vendorId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price.amount' } } }
      ]);
      const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

      // 4. Average Rating
      const ratingResult = await Booking.aggregate([
        { $match: { vendor: vendorId, 'rating.score': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$rating.score' } } }
      ]);
      const avgRating = ratingResult.length > 0 ? ratingResult[0].avg : 0;

      // 5. Recent Bookings
      const recentBookings = await Booking.find({ vendor: vendorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'name')
        .populate('service', 'title');

      // 6. Recent Reviews
      const recentReviews = await Booking.find({
        vendor: vendorId,
        status: 'completed',
        'rating.review': { $exists: true, $ne: '' } // Find reviews with non-empty text
      })
      .sort({ 'rating.date': -1 })
      .limit(3)
      .populate('customer', 'name')
      .select('rating customer');

      res.json({
        stats: { activeBookings, completedServices, totalRevenue, avgRating },
        recentBookings,
        recentReviews // Add recent reviews to the response
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
