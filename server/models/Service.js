import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  // 🔥 FIXED: Proper Reference
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },

  description: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // 🔥 ADDED: Denormalized location for efficient geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number] // [longitude, latitude]
    }
  },

  pricing: {
    type: {
      type: String,
      enum: ['fixed', 'hourly', 'custom'],
      default: 'fixed'
    },
    amount: {
      type: Number,
      min: 0
    },
    unit: String
  },

  duration: {
    estimated: Number,
    unit: {
      type: String,
      default: 'minutes'
    }
  },

  images: {
    type: [String],
    default: []
  },

  tags: {
    type: [String],
    index: true,
    default: []
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  requirements: {
    type: [String],
    default: []
  },

  included: {
    type: [String],
    default: []
  },

  excluded: {
    type: [String],
    default: []
  }

}, { timestamps: true });

/* 🔥 PERFORMANCE INDEXES */
serviceSchema.index({ location: '2dsphere' }); // Index for geospatial queries
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ vendor: 1, isActive: 1 });
serviceSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Add text index for searching

export default mongoose.model('Service', serviceSchema);
