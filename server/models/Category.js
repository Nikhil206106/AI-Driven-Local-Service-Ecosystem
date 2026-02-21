import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  image: {
    type: String,
    required: true
  },

  icon: {
    type: String,
    default: '🛠️',
  },

  description: {
    type: String,
    trim: true,
  },

  // 🔥 IMPORTANT FOR AI FILTERING
  isActive: {
    type: Boolean,
    default: true,
  },

  // 🔥 Optional: AI optimization
  aiLabel: {
    type: String,
    trim: true,
  },

  // 🔥 Optional: sort order
  priority: {
    type: Number,
    default: 0,
  }

}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
