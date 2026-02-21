import express from 'express';
import Booking from '../models/Booking.js';
import Vendor from '../models/Vendor.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Vendor Dashboard Analytics
router.get('/vendor', authorizeRole(['vendor']), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found.' });
    }

    const vendorId = vendor._id;

    // Stats
    const activeBookings = await Booking.countDocuments({ vendor: vendorId, status: { $in: ['confirmed', 'in-progress'] } });
    const completedServices = await Booking.countDocuments({ vendor: vendorId, status: 'completed' });

    const revenueData = await Booking.aggregate([
      { $match: { vendor: vendorId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price.amount' } } }
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    const ratingData = await Booking.aggregate([
        { $match: { vendor: vendorId, status: 'completed', 'rating.score': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating.score' } } }
    ]);
    const avgRating = ratingData[0]?.avgRating || 0;

    // Recent Bookings
    const recentBookings = await Booking.find({ vendor: vendorId })
      .populate('customer', 'name')
      .populate('service', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        activeBookings,
        completedServices,
        totalRevenue,
        avgRating
      },
      recentBookings
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Dashboard Analytics
router.get('/customer', authorizeRole(['customer']), async (req, res) => {
    try {
        const customerId = req.user._id;

        const activeBookings = await Booking.countDocuments({ customer: customerId, status: { $in: ['pending', 'confirmed', 'in-progress'] } });
        const completedServices = await Booking.countDocuments({ customer: customerId, status: 'completed' });

        const spentData = await Booking.aggregate([
            { $match: { customer: customerId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$price.amount' } } }
        ]);
        const totalSpent = spentData[0]?.total || 0;

        const ratingData = await Booking.aggregate([
            { $match: { customer: customerId, status: 'completed', 'rating.score': { $exists: true } } },
            { $group: { _id: null, avgRating: { $avg: '$rating.score' } } }
        ]);
        const avgRating = ratingData[0]?.avgRating || 0;

        res.json({
            stats: {
                activeBookings,
                completedServices,
                totalSpent,
                avgRating: avgRating ? avgRating.toFixed(1) : 0
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;