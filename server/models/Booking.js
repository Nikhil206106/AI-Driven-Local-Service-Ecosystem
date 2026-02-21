import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'verification-pending', 'rejected', 'reported'],
    default: 'pending'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  price: {
    amount: Number,
    currency: {
      type: String,
      default: 'INR'
    }
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid_to_platform', 'payout_pending', 'paid_to_vendor', 'refund_pending', 'refunded'],
      default: 'pending'
    },
    transactionId: String, // Customer's payment transaction ID
    payoutId: String,      // Vendor's payout transaction ID
    paidAt: Date,
    payoutAt: Date,
    notes: String
  },
  address: {
    street: String,
    city: String,
    zipCode: String
  },
  notes: {
    customerNotes: String,
    vendorNotes: String,
  },
  rating: {
    score: { type: Number, min: 1, max: 5 },
    review: String,
    date: Date,
  },
  completionOtp: String,
  completionOtpExpires: Date,
  report: {
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    description: String,
    status: { type: String, enum: ['open', 'under_review', 'resolved'] },
    createdAt: { type: Date },
    resolution: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  dispute: {
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    description: String,
    status: { type: String, enum: ['open', 'under_review', 'resolved'] },
    createdAt: { type: Date },
    resolution: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  timeline: [{
    status: String,
    note: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('Booking', bookingSchema);