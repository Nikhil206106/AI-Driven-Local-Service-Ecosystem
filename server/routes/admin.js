import express from 'express';
// Import controller functions from the userController file
import { getUsers, updateUser, deleteUser } from '../userController.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Vendor from '../models/Vendor.js';
import Category from '../models/Category.js';
import Booking from '../models/Booking.js';
import { authorizeRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure Multer for category images
const categoryImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/categories';
    if (!fs.existsSync('uploads/')) {
      fs.mkdirSync('uploads/');
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `category-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const uploadCategoryImage = multer({ storage: categoryImageStorage });
// Default images for services
const DEFAULT_IMAGE = ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800'];

// ===============================
// Analytics (Unchanged)
// ===============================
router.get('/analytics', authorizeRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalVendors = await Vendor.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    
    const totalRevenue = await Booking.aggregate([
      // Correctly calculate revenue based on money paid to the platform,
      // regardless of whether it has been paid out to the vendor yet.
      { $match: { 'payment.status': { $in: ['paid_to_platform', 'payout_pending', 'paid_to_vendor'] } } },
      { $group: { _id: null, total: { $sum: '$price.amount' } } }
    ]);

    const monthlyBookings = await Booking.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      totalUsers,
      totalVendors,
      totalBookings,
      completedBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyBookings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// User Management Routes (Delegated to userController.js)
// ===============================

// @route GET /api/admin/users
// @desc Get a list of all users with search and pagination (Uses Controller)
router.get('/users', authorizeRole(['admin']), getUsers);

// @route GET /api/admin/users/:id
// @desc Get single user detail (Kept inline as simple lookup)
router.get('/users/:id', authorizeRole(['admin']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// @route PUT /api/admin/users/:id
// @desc Update user role and active status (Uses Controller, replaces old PATCH /status)
router.put('/users/:id', authorizeRole(['admin']), updateUser);

// @route DELETE /api/admin/users/:id
// @desc Delete a user (Uses Controller)
router.delete('/users/:id', authorizeRole(['admin']), deleteUser);

/* * NOTE: The old 'router.patch('/users/:id/status', ...)' route has been removed 
 * for consolidation. The new PUT /users/:id (updateUser in the controller) 
 * now handles isActive and role updates in a single request. 
 * If you still need to update 'isVerified', you must implement that logic 
 * within the updateUser function or create a new dedicated PATCH route for it.
*/

// ===============================
// Get all vendors (Unchanged)
// ===============================
router.get('/vendors', authorizeRole(['admin']), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.verificationStatus = status;
    }

    const vendors = await Vendor.find(query)
      .populate('user', 'name email phone createdAt isActive isVerified')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vendor.countDocuments(query);

    res.json({
      vendors,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// Category Management
// ===============================

// Get all categories (Seed if empty)
router.get('/categories', authorizeRole(['admin']), async (req, res) => {
  try {
    let categories = await Category.find().sort({ name: 1 });

    if (categories.length === 0) {
      const seedData = [
        { name: 'Plumbing', slug: 'plumbing', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800' },
        { name: 'Electrical', slug: 'electrical', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800' },
        { name: 'Cleaning', slug: 'cleaning', image: 'https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80&w=800' },
        { name: 'Painting', slug: 'painting', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=800' },
        { name: 'Carpentry', slug: 'carpentry', image: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=800' },
        { name: 'Appliance Repair', slug: 'appliance-repair', image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a782?auto=format&fit=crop&q=80&w=800' },
        { name: 'HVAC', slug: 'hvac', image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=800' },
        { name: 'Landscaping', slug: 'landscaping', image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&q=80&w=800' },
        { name: 'Moving', slug: 'moving', image: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&q=80&w=800' },
        { name: 'Pest Control', slug: 'pest-control', image: 'https://images.unsplash.com/photo-1587574293340-e0011c4e8ecf?auto=format&fit=crop&q=80&w=800' },
        { name: 'Handyman', slug: 'handyman', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=800' }
      ];
      categories = await Category.insertMany(seedData);
    }

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a category image
router.put('/categories/:id', authorizeRole(['admin']), uploadCategoryImage.single('imageFile'), async (req, res) => {
  try {
    let imageUrl;

    if (req.file) {
      // If a file was uploaded, use its path
      imageUrl = req.file.path.replace(/\\/g, '/');
    } else if (req.body.image && typeof req.body.image === 'string' && req.body.image.trim() !== '') {
      // If a URL string was provided in the body
      imageUrl = req.body.image.trim();
    } else {
      return res.status(400).json({ error: 'An image file or a non-empty image URL string is required.' });
    }
    
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { image: imageUrl },
      { new: true, runValidators: true } // runValidators ensures schema rules are checked
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid category ID format.' });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Server error while updating category.' });
  }
});

// ===============================
// Update vendor verification status
// ===============================
router.patch('/vendors/:id/verify', authorizeRole(['admin']), async (req, res) => {
  try {
    const { verificationStatus, adminNotes } = req.body;

    // 1. Validate input
    if (!['verified', 'rejected', 'pending'].includes(verificationStatus)) {
      return res.status(400).json({ error: 'Invalid verificationStatus. Must be one of: verified, rejected, pending.' });
    }

    // 2. Find the vendor
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // 3. Update vendor properties
    vendor.verificationStatus = verificationStatus;
    if (adminNotes) {
      vendor.adminNotes = adminNotes;
    }
    if (verificationStatus === 'verified') {
      vendor.verifiedBy = req.user._id;
      vendor.verificationDate = new Date();
    } else {
      vendor.verifiedBy = null;
      vendor.verificationDate = null;
    }

    // 4. Synchronize the linked User account status
    const isVerifiedForUser = verificationStatus === 'verified';
    // Deactivate user if vendor is rejected.
    const isActiveForUser = verificationStatus !== 'rejected';

    const updatedUser = await User.findByIdAndUpdate(
      vendor.user,
      { isVerified: isVerifiedForUser, isActive: isActiveForUser },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      console.error(`CRITICAL: Vendor ${vendor._id} has a dangling user reference: ${vendor.user}.`);
      await vendor.save(); // Save the vendor change anyway
      return res.status(500).json({
        error: 'Vendor status updated, but the linked user account could not be found to synchronize. Please investigate.',
        vendor,
      });
    }

    // 5. Save the vendor and respond with the updated user data
    await vendor.save();
    vendor.user = updatedUser; // Attach for the response
    
    let newServices = [];
    // If vendor is newly verified, create default services and notify clients
    if (verificationStatus === 'verified') {
      const existingServices = await Service.find({ vendor: vendor._id });
      
      if (existingServices.length === 0 && vendor.serviceCategories?.length > 0) {
        // Fetch category images from DB
        const categories = await Category.find({ slug: { $in: vendor.serviceCategories } });
        const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.slug]: c.image }), {});

        const defaultServices = vendor.serviceCategories.map(cat => ({
          title: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Service`,
          description: `Professional ${cat.replace('-', ' ')} service by ${vendor.businessName}`,
          category: cat,
          pricing: { type: 'fixed', amount: 500, unit: 'per job' },
          images: categoryMap[cat] ? [categoryMap[cat]] : DEFAULT_IMAGE,
          vendor: vendor._id,
          isActive: true,
        }));

        const insertedServices = await Service.insertMany(defaultServices);
        vendor.services = insertedServices.map(s => s._id);
        await vendor.save();
        newServices = insertedServices;

        // Emit real-time event via Socket.IO
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
    }

    res.json({
      message: `Vendor status updated to ${verificationStatus}.`,
      vendor,
      newServices,
    });

  } catch (error) {
    console.error('Error during vendor verification:', error);
    res.status(500).json({ error: error.message });
  }
});
// ===============================
// Get all bookings (Unchanged)
// ===============================
router.get('/bookings', authorizeRole(['admin']), async (req, res) => {
  try {
    const { status, page = 1, limit = 20, customerId, vendorId } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    if (customerId) {
      query.customer = customerId;
    }
    if (vendorId) {
      query.vendor = vendorId;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone')
      .populate({
        path: 'vendor',
        populate: {
          path: 'user',
          select: 'name email phone'
        }
      })
      .populate('service', 'title category')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// Get Dashboard Activities
// ===============================
router.get('/activities', authorizeRole(['admin']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const [recentBookings, recentUsers, recentVendors] = await Promise.all([
      Booking.find().sort({ createdAt: -1 }).limit(limit).populate('customer', 'name').populate('service', 'title'),
      User.find().sort({ createdAt: -1 }).limit(limit),
      Vendor.find().sort({ createdAt: -1 }).limit(limit)
    ]);

    const activities = [
      ...recentBookings.map(b => ({
        id: b._id,
        type: 'booking',
        message: `New booking: ${b.service?.title || 'Service'} by ${b.customer?.name || 'Customer'}`,
        date: b.createdAt,
        status: b.status
      })),
      ...recentUsers.map(u => ({
        id: u._id,
        type: 'user',
        message: `New user joined: ${u.name}`,
        date: u.createdAt,
        status: 'active'
      })),
      ...recentVendors.map(v => ({
        id: v._id,
        type: 'vendor',
        message: `New vendor joined: ${v.businessName}`,
        date: v.createdAt,
        status: v.verificationStatus
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// DANGER ZONE: Clear All Data
// ===============================
router.delete('/clear-all-data', authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUserId = req.user._id;

    // We will not delete the currently logged-in admin.
    // All other users, and all data associated with them, will be deleted.
    const deleteUsersPromise = User.deleteMany({ _id: { $ne: adminUserId } });
    const deleteVendorsPromise = Vendor.deleteMany({});
    const deleteServicesPromise = Service.deleteMany({});
    const deleteBookingsPromise = Booking.deleteMany({});
    const deleteCategoriesPromise = Category.deleteMany({});

    await Promise.all([
      deleteUsersPromise,
      deleteVendorsPromise,
      deleteServicesPromise,
      deleteBookingsPromise,
      deleteCategoriesPromise,
    ]);

    res.json({ message: 'All non-admin data has been cleared successfully. The admin account remains.' });
  } catch (error) {
    console.error('Error clearing all data:', error);
    res.status(500).json({ error: 'Failed to clear all data.' });
  }
});

// ===============================
// Dispute and Report Management
// ===============================

// Get all open disputes
router.get('/disputes', authorizeRole(['admin']), async (req, res) => {
  try {
    const disputes = await Booking.find({ status: 'reported' })
      .populate('customer', 'name email')
      .populate({
        path: 'vendor',
        select: 'businessName user',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('service', 'title')
      .populate({
        path: 'dispute.raisedBy',
        model: 'User',
        select: 'name role'
      })
      .sort({ 'dispute.createdAt': -1 });
    res.json(disputes);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Server error fetching disputes.' });
  }
});

// Resolve a dispute
router.patch('/disputes/:id/resolve', authorizeRole(['admin']), async (req, res) => {
  const { resolution, finalStatus } = req.body;
  if (!resolution || !finalStatus) {
    return res.status(400).json({ error: 'Resolution notes and a final status are required.' });
  }
  if (!['completed', 'cancelled'].includes(finalStatus)) {
    return res.status(400).json({ error: 'Invalid final status.' });
  }

  try {
    const booking = await Booking.findById(req.params.id).populate('customer', '_id').populate({ path: 'vendor', populate: { path: 'user', select: '_id' } });
    if (!booking || !booking.dispute) {
      return res.status(404).json({ error: 'Disputed booking not found.' });
    }

    booking.dispute.status = 'resolved';
    booking.dispute.resolution = resolution;
    booking.dispute.resolvedBy = req.user._id;
    booking.dispute.resolvedAt = new Date();
    booking.status = finalStatus;

    if (booking.payment) {
      if (finalStatus === 'completed') {
        booking.payment.status = 'payout_pending';
      } else if (finalStatus === 'cancelled') {
        booking.payment.status = 'refund_pending';
      }
    }

    booking.timeline.push({
      status: 'resolved',
      note: `Admin resolved the dispute. Final status set to '${finalStatus}'. Resolution: "${resolution}"`,
    });

    await booking.save();

    const notificationPayload = { bookingId: booking._id, finalStatus, resolution };
    req.io.to(booking.customer._id.toString()).emit('dispute-resolved', notificationPayload);
    if (booking.vendor?.user?._id) {
      req.io.to(booking.vendor.user._id.toString()).emit('dispute-resolved', notificationPayload);
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Server error while resolving dispute.' });
  }
});

export default router;
