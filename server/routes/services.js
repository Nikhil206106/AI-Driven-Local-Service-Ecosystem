import express from 'express';
import Service from '../models/Service.js';
import Vendor from '../models/Vendor.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure Multer for service images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'service-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

// ------------------------
// Get all services
// ------------------------
router.get('/', async (req, res) => {
  try {
    const { category, search, lat, lng, radius = 10, city } = req.query;

    let pipeline = [];

    // 1️⃣ Geospatial search (if lat/lng provided)
    // This is the most efficient way to filter by location.
    if (lat && lng) {
      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: 'distance', // Adds a 'distance' field in meters
          maxDistance: parseFloat(radius) * 1000, // radius in km -> meters
          query: { isActive: true }, // Pre-filter on indexed fields for efficiency
          spherical: true
        }
      });
    } else {
      // If not doing a geo-search, start by matching active services
      pipeline.push({ $match: { isActive: true } });
    }

    // 2️⃣ Join Vendor
    pipeline.push({
      $lookup: {
        from: 'vendors',
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorData'
      }
    });
    pipeline.push({ $unwind: '$vendorData' });

    // 3️⃣ Filter for verified vendors
    pipeline.push({
      $match: {
        'vendorData.verificationStatus': 'verified',
      }
    });

    // 4️⃣ Search filter
    if (search) {
      // Using a regex for more flexible, case-insensitive searching across multiple fields.
      // This is more forgiving than a simple text search and will find partial matches.
      // For true fuzzy search (handling typos), MongoDB Atlas Search is recommended.
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { category: searchRegex } // Allows searching by category slug, e.g., "plumb"
          ]
        }
      });
    }

    // 5️⃣ Category filter
    if (category) {
      // The 'category' from query params is a slug string like 'plumbing', not an ObjectId.
      // The Service model stores the category as a slug.
      pipeline.push({ $match: { category: category } });
    }

    // 6️⃣ Join User
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'vendorData.user',
        foreignField: '_id',
        as: 'userData'
      }
    });
    pipeline.push({ $unwind: '$userData' });

    // 7️⃣ Optional: Filter by city name if lat/lng not provided
    if (city && (!lat || !lng)) {
      pipeline.push({
        $match: {
          'userData.address.city': { $regex: city, $options: 'i' }
        }
      });
    }

    // 8️⃣ Project final shape
    pipeline.push({
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        category: 1,
        isActive: 1,
        tags: 1,
        images: 1,
        createdAt: 1,
        pricing: 1,
        price: '$pricing.amount', // frontend convenience
        distance: { $ifNull: ['$distance', null] }, // Include distance if available
        vendor: {
          _id: '$vendorData._id',
          businessName: '$vendorData.businessName',
          serviceCategories: '$vendorData.serviceCategories',
          user: {
            _id: '$userData._id',
            name: '$userData.name',
            ratings: '$userData.ratings',
            address: '$userData.address'
          }
        }
      }
    });

    const services = await Service.aggregate(pipeline).sort({ createdAt: -1 });
    res.json(services);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Get service by ID
// ------------------------
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate({
        path: 'vendor',
        populate: {
          path: 'user',
          select: 'name ratings address profileImage'
        }
      });

    if (!service) return res.status(404).json({ error: 'Service not found' });

    if (service.vendor?.verificationStatus !== 'verified') {
      return res.status(404).json({ error: 'Service not found or vendor not verified' });
    }

    res.json(service);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Create service (vendor only)
// ------------------------
router.post('/', authenticateToken, authorizeRole(['vendor']), upload.array('images', 5), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor profile not found for the current user.' });
    }

    if (vendor.verificationStatus !== 'verified') {
      return res.status(403).json({ error: 'Your vendor profile must be verified to create services.' });
    }

    // Parse JSON fields if they come as strings (FormData)
    if (typeof req.body.pricing === 'string') req.body.pricing = JSON.parse(req.body.pricing);
    if (typeof req.body.duration === 'string') req.body.duration = JSON.parse(req.body.duration);
    if (typeof req.body.included === 'string') req.body.included = JSON.parse(req.body.included);
    if (typeof req.body.excluded === 'string') req.body.excluded = JSON.parse(req.body.excluded);
    if (typeof req.body.requirements === 'string') req.body.requirements = JSON.parse(req.body.requirements);
    if (typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);

    // Handle images
    const imagePaths = req.files ? req.files.map(file => file.path.replace(/\\/g, '/')) : [];

    const service = new Service({
      ...req.body,
      vendor: vendor._id, // Ensure the service is linked to the correct vendor
      images: imagePaths
    });

    await service.save();

    // Also add the service to the vendor's list of services
    vendor.services.push(service._id);
    await vendor.save();

    // Populate the new service to match the structure expected by the frontend for real-time updates
    const populatedService = await Service.findById(service._id)
      .populate({
        path: 'vendor',
        select: 'businessName verificationStatus user',
        populate: {
          path: 'user',
          select: 'name ratings'
        }
      });

    // Emit real-time event via Socket.IO to update all connected clients
    if (populatedService) {
      const { io } = await import('../index.js');
      io.emit('serviceUpdated', { vendorId: vendor._id, services: [populatedService] });
    }

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Update a service (vendor only)
// ------------------------
router.put('/:id', authenticateToken, authorizeRole(['vendor']), upload.array('images', 5), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    // Parse JSON fields if they come as strings
    if (typeof req.body.pricing === 'string') req.body.pricing = JSON.parse(req.body.pricing);
    if (typeof req.body.duration === 'string') req.body.duration = JSON.parse(req.body.duration);
    if (typeof req.body.included === 'string') req.body.included = JSON.parse(req.body.included);
    if (typeof req.body.excluded === 'string') req.body.excluded = JSON.parse(req.body.excluded);
    if (typeof req.body.requirements === 'string') req.body.requirements = JSON.parse(req.body.requirements);
    if (typeof req.body.tags === 'string') req.body.tags = JSON.parse(req.body.tags);

    let updateData = { ...req.body };

    // If new images are uploaded, append them to the existing ones
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => f.path.replace(/\\/g, '/'));
      const existingService = await Service.findOne({ _id: req.params.id, vendor: vendor._id });
      if (existingService) {
        // Combine existing images with new ones
        updateData.images = [...(existingService.images || []), ...newImages];
      }
    }

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id }, // Ensure vendor owns this service
      updateData,
      { new: true, runValidators: true }
    );

    if (!service) return res.status(404).json({ error: 'Service not found or you do not have permission to edit it.' });

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Delete a service (vendor only)
// ------------------------
router.delete('/:id', authenticateToken, authorizeRole(['vendor']), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found.' });

    const service = await Service.findOneAndDelete({ _id: req.params.id, vendor: vendor._id });

    if (!service) return res.status(404).json({ error: 'Service not found or you do not have permission to delete it.' });

    // Remove the service from the vendor's services array
    await Vendor.updateOne({ _id: vendor._id }, { $pull: { services: service._id } });

    res.json({ message: 'Service deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------
// Get service categories
// ------------------------
router.get('/categories/list', async (req, res) => {
    try {
        // Fetch all active categories from the Category collection, which is the source of truth.
        // This ensures all available categories are shown, not just those with existing services.
        const categories = await Category.find({ isActive: { $ne: false } })
            .sort({ priority: -1, name: 1 });

        res.json(categories.map(cat => ({
            id: cat.slug, // The frontend uses this ID as the value for filtering, which is the slug.
            name: cat.name,
            icon: cat.icon, // Pass icon if available
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
