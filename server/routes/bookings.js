import express from 'express';
import Booking from '../models/Booking.js';
import Vendor from '../models/Vendor.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import sendEmail from '../utils/sendEmail.js';



const router = express.Router();

// Protect all booking routes
router.use(authenticateToken);

// Create booking
router.post('/', async (req, res) => {
  try {
    const { role, _id } = req.user;
    let customerId;

    if (role === 'customer') {
      customerId = _id;
    } else if (role === 'admin') {
      if (!req.body.customer) {
        return res.status(400).json({ error: 'Admin must specify a customer for the booking.' });
      }
      customerId = req.body.customer;
    } else {
      return res.status(403).json({ error: 'Only customers or admins can book services.' });
    }

    const booking = new Booking({
      ...req.body,
      customer: customerId,
      // Simulate that the customer pays the platform upfront upon booking.
      // In a real app, this would be set after a successful payment gateway transaction.
      payment: { status: 'paid_to_platform', paidAt: new Date() },
    });

    // Add initial timeline event for better tracking
    booking.timeline.push({
      status: 'pending',
      note: `Booking created by ${role}.`,
    });

    await booking.save();

    // Populate for response
    await booking.populate([
      { path: 'customer', select: 'name email phone' },
      { path: 'vendor', populate: { path: 'user', select: 'name email phone' } },
      { path: 'service', select: 'title category pricing' }
    ]);

    // Send real-time notification to vendor
    if (booking.vendor?.user?._id) {
      req.io.to(booking.vendor.user._id.toString()).emit('new-booking', {
        bookingId: booking._id,
        customer: booking.customer,
        service: booking.service,
        scheduledDate: booking.scheduledDate,
      });
    }
    
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's bookings
router.get('/', async (req, res) => {
  try {
    const { view } = req.query; // Changed from 'status' to 'view'
    let query = {};
    if (req.user.role === 'customer') {
      query = { customer: req.user._id };
    } else if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      if (!vendor) {
        // This case should be rare if the user has a vendor role but it's good to handle.
        return res.json([]);
      }
      query = { vendor: vendor._id };
    } else if (req.user.role === 'admin') {
      // For admins, query is empty, fetching all bookings.
      query = {};
    } else {
      // For any other unhandled role or no role, return empty.
      return res.json([]);
    }

    // New view-based filtering logic. The backend now determines what each view means.
    if (view && view !== 'all') {
      switch(view) {
        case 'upcoming':
          // An "upcoming" booking is one in the future that has not been finalized (completed/cancelled/rejected).
          query.scheduledDate = { $gte: new Date() };
          query.status = { $nin: ['completed', 'cancelled', 'rejected'] };
          break;
        case 'pending':
          query.status = 'pending';
          break;
        case 'confirmed':
          query.status = 'confirmed';
          break;
        case 'in-progress':
          // The "In Progress" tab should show jobs that are actively being worked on
          // AND jobs that are awaiting OTP verification.
          query.status = { $in: ['in-progress', 'verification-pending'] };
          break;
        case 'completed':
          query.status = 'completed';
          break;
        case 'cancelled':
          // The "Cancelled" tab should show both rejected and cancelled jobs.
          query.status = { $in: ['cancelled', 'rejected'] };
          break;
        case 'reported':
          // The "Reported" tab for users to see their bookings with open reports.
          // We also check for the existence of a reason to filter out "ghost" reports
          // that might be created with just a default status.
          query['report.status'] = 'open';
          query['report.reason'] = { $exists: true, $ne: null };
          break;
        // No default case needed; if view is unknown, we show all (as if view='all').
      }
    }
    
    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone') // Temporarily populate phone
      .populate({
        path: 'vendor',
        populate: {
          path: 'user',
          select: 'name email phone' // Temporarily populate phone
        }
      })
      .populate('service', 'title category pricing')
      .sort({ createdAt: -1 });

    // Conditionally strip sensitive info based on status for list view
    const canViewContactInfoStatuses = ['confirmed', 'in-progress', 'completed'];
    const results = bookings.map(booking => {
      const bookingObject = booking.toObject();
      const canView = canViewContactInfoStatuses.includes(bookingObject.status);

      if (!canView) {
        if (bookingObject.customer) delete bookingObject.customer.phone;
        if (bookingObject.vendor?.user) delete bookingObject.vendor.user.phone;
      }
      return bookingObject;
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      // Populate all fields initially; we will filter them based on role and status
      .populate('customer', 'name email phone address profileImage')
      .populate({
        path: 'vendor',
        populate: {
          path: 'user',
          select: 'name email phone address profileImage'
        }
      })
      .populate('service')
      .populate({
        path: 'report.raisedBy',
        model: 'User',
        select: 'name role'
      });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // --- Authorization & Data Privacy Logic ---
    const isCustomer = booking.customer?._id.equals(req.user._id);
    const isVendor = booking.vendor?.user?._id.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You are not part of this booking.' });
    }

    // Convert to a plain object to safely modify it before sending
    const bookingObject = booking.toObject();

    // Define which statuses allow contact info to be shared
    const canViewContactInfo = ['confirmed', 'in-progress', 'completed'].includes(booking.status);

    // If the user is a VENDOR, hide the CUSTOMER's phone unless appropriate
    if (isVendor && !canViewContactInfo) {
      if (bookingObject.customer) delete bookingObject.customer.phone;
    }

    // If the user is a CUSTOMER, hide the VENDOR's phone unless appropriate
    if (isCustomer && !canViewContactInfo) {
      if (bookingObject.vendor?.user) delete bookingObject.vendor.user.phone;
    }

    // Admins can see everything, so no fields are removed for them.
    res.json(bookingObject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OTP for a booking (customer only)
router.get('/:id/otp', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Authorization: Only the customer of this booking can get the OTP.
    if (!booking.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access denied. You are not the customer for this booking.' });
    }

    // OTP is only available when pending verification.
    if (booking.status !== 'verification-pending') {
      return res.status(400).json({ error: 'OTP is only available for bookings pending verification.' });
    }

    // If OTP is expired or doesn't exist, regenerate it.
    if (!booking.completionOtp || !booking.completionOtpExpires || booking.completionOtpExpires < new Date()) {
      booking.completionOtp = Math.floor(100000 + Math.random() * 900000).toString();
      booking.completionOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry
      await booking.save();
      console.log(`🔄 Regenerated OTP for booking ${booking._id}: ${booking.completionOtp}`);
    }

    res.json({ otp: booking.completionOtp });

  } catch (error) {
    console.error(`Error fetching OTP for booking ${req.params.id}:`, error);
    res.status(500).json({ error: 'Server error while fetching OTP.' });
  }
});

// Update booking details (by customer or admin)
router.put('/:id', async (req, res) => {
  try {
    const { scheduledDate, address, notes } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('vendor', 'user');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization: Only customer or admin can edit.
    const isCustomer = booking.customer.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to edit this booking.' });
    }

    // Logic: Allow edits only on pending or confirmed bookings.
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot edit a booking with status "${booking.status}".` });
    }

    let updateNote = 'Booking details updated';
    if (scheduledDate) {
      booking.scheduledDate = scheduledDate;
      updateNote += ' (Date/Time changed)';
    }
    if (address) {
      booking.address = { ...booking.address, ...address };
      updateNote += ' (Address changed)';
    }
    if (notes) {
      booking.notes.customerNotes = notes;
      updateNote += ' (Notes added/changed)';
    }

    booking.timeline.push({
      status: 'updated',
      note: `${updateNote} by ${req.user.role}.`,
    });

    await booking.save();

    // Notify the other party
    const targetUserId = req.user.role === 'customer' ? booking.vendor?.user : booking.customer;
    if (targetUserId) {
      req.io.to(targetUserId.toString()).emit('booking-details-update', { bookingId: booking._id });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes, otp } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'verification-pending', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status provided: ${status}.` });
    }

    // Find the booking and populate vendor for access checks
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'vendor',
        populate: { path: 'user', select: '_id' },
      });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization: Only the customer, vendor, or an admin can update the status
    const isCustomer = booking.customer?.equals(req.user._id);
    const isVendor = booking.vendor?.user?._id?.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You cannot update this booking.' });
    }

    // --- OTP Verification Logic ---
    // This must happen before general status updates
    if (status === 'completed' && booking.status === 'verification-pending') {
      if (isVendor) {
        if (!otp) {
          return res.status(400).json({ error: 'OTP is required to complete the booking.' });
        }
        if (booking.completionOtp !== otp) {
          return res.status(400).json({ error: 'Invalid OTP provided.' });
        }
      } else if (!isAdmin) {
        // If it's not the vendor trying to complete, it must be an admin.
        return res.status(403).json({ error: 'Only the vendor or an admin can complete this booking.' });
      }
      booking.completionOtp = undefined; // Clear OTP after use

      // Since the job is complete, mark the payment as ready for vendor payout.
      if (booking.payment) booking.payment.status = 'payout_pending';

    }

    // --- Role-based status transition validation ---
    if (isCustomer) {
      // A customer can only cancel a booking that isn't already finished or cancelled.
      if (status !== 'cancelled') {
        return res.status(403).json({ error: 'As a customer, you can only cancel a booking.' });
      }
      if (['completed', 'cancelled', 'rejected'].includes(booking.status)) {
        return res.status(400).json({ error: `Cannot cancel a booking that is already ${booking.status}.` });
      }
    }

    if (isVendor) {
      // A vendor can manage the lifecycle.
      const allowedVendorStatuses = ['confirmed', 'rejected', 'in-progress', 'verification-pending', 'cancelled', 'completed'];
      if (!allowedVendorStatuses.includes(status)) {
        return res.status(403).json({ error: `As a vendor, you cannot set the status to '${status}'.` });
      }
      // Prevent vendor from completing a job without OTP flow
      if (status === 'completed' && booking.status !== 'verification-pending') {
        return res.status(400).json({ error: 'Cannot complete a booking directly. Please use the OTP verification flow.' });
      }
    }

    let generatedOtp = null;
    // Generate OTP if status is changing to verification-pending
    if (status === 'verification-pending') {
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      booking.completionOtp = generatedOtp;
      booking.completionOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
      
      // Log to console for dev
      console.log('\n================================================================');
      console.log('🔐  OTP GENERATED FOR BOOKING COMPLETION');
      console.log(`🆔  Booking ID: ${booking._id}`);
      console.log(`🔑  CODE:       ${generatedOtp}`);
      console.log('================================================================\n');
    }

    booking.status = status;
    if (notes) {
      if (!booking.notes) booking.notes = {}; // Ensure notes object exists
      if (req.user.role === 'customer') {
        booking.notes.customerNotes = notes;
      } else if (req.user.role === 'vendor') {
        booking.notes.vendorNotes = notes;
      }
    }

    // Add a record of this change to the booking's timeline
    booking.timeline.push({
      status,
      note: notes || `Status updated to ${status} by ${req.user.role}`,
      timestamp: new Date(),
    });

    await booking.save();

    // Send real-time notification to the other party involved in the booking
    const isCustomerUpdating = req.user.role === 'customer';
    const targetUserId = (isCustomerUpdating
      ? booking.vendor?.user?._id
      : booking.customer)?.toString(); // Ensure targetUserId is a string

    if (targetUserId) {
      console.log(`Backend: Attempting to emit booking-status-update to user ID: ${targetUserId}`); // Debug log
      const statusUpdatePayload = {
        bookingId: booking._id.toString(), // Ensure bookingId is a string for frontend comparison
        status,
        updatedBy: req.user.role,
      };

      // If an OTP was generated, send it in the same block to ensure atomicity
      if (status === 'verification-pending' && generatedOtp) {
        // Also send the backup email, populating customer info first
        await booking.populate('customer', 'name email');
        if (booking.customer && booking.customer.email) {
          const recipientEmail = 'bapvesupp@gmail.com'; // Hardcoded for demo purposes
          const customerIdentifier = `${booking.customer.name} (${booking.customer.email})`; // For logging/subject
          const otpMessage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                <h2 style="color: white; margin: 0;">Your Service Verification Code</h2>
              </div>
              <div style="padding: 20px;">
                <p>Hello <strong>${booking.customer.name}</strong>,</p>
                <p>Your vendor has requested to mark the service as completed. To confirm, please provide them with the following verification code:</p>
                <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <h1 style="letter-spacing: 5px; color: #1f2937; margin: 0; font-size: 32px;">${generatedOtp}</h1>
                </div>
                <p style="color: #6b7280; font-size: 14px;">If you did not authorize this, please contact support.</p>
              </div>
            </div>
          `;

          try {
            await sendEmail({ email: recipientEmail, subject: `Service Completion OTP for ${customerIdentifier}`, message: otpMessage });
            console.log(`📧 OTP Email sent to ${recipientEmail}`);
          } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            // We don't throw here because the real-time OTP is the primary method.
          }
        }
      }

      console.log('Backend: Final payload before emitting:', statusUpdatePayload); // Debug log
      // Emit the single, consolidated event
      req.io.to(targetUserId).emit('booking-status-update', statusUpdatePayload);
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Raise a report for a booking
router.post('/:id/dispute', async (req, res) => {
  try {
    const { reason, description } = req.body;
    if (!reason || !description) {
      return res.status(400).json({ error: 'Reason and description are required to report an issue.' });
    }

    const booking = await Booking.findById(req.params.id).populate('vendor', 'user');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Authorization: Only customer or vendor can report an issue.
    const isCustomer = booking.customer.equals(req.user._id);
    const isVendor = booking.vendor?.user?._id.equals(req.user._id);

    if (!isCustomer && !isVendor) {
      return res.status(403).json({ error: 'You are not authorized to report an issue for this booking.' });
    }

    // Logic: Can only report issues for bookings that are in progress, completed, or pending verification.
    const reportableStatuses = ['in-progress', 'verification-pending', 'completed'];
    if (!reportableStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Cannot report an issue for a booking with status "${booking.status}".` });
    }
    
    if (booking.dispute && booking.dispute.status === 'open') {
        return res.status(400).json({ error: 'An issue has already been reported for this booking and is currently open.' });
    }

    // Add report info and update booking status to 'reported'
    booking.status = 'reported';
    booking.dispute = {
      raisedBy: req.user._id,
      reason,
      description,
      status: 'open',
      createdAt: new Date(),
    };

    booking.timeline.push({
      status: 'reported',
      note: `Dispute raised by ${req.user.role}: "${reason}"`,
    });

    await booking.save();

    // Notify all admins about the new report
    try {
      const admins = await User.find({ role: 'admin' }).select('_id');
      if (admins.length > 0) {
        const adminIds = admins.map(admin => admin._id.toString());
        const notificationPayload = {
          bookingId: booking._id,
          reason: booking.dispute.reason,
          raisedBy: {
            name: req.user.name, // req.user is available from authenticateToken
            role: req.user.role,
          }
        };
        // Emit to each admin's room
        adminIds.forEach(adminId => {
          req.io.to(adminId).emit('new-dispute', notificationPayload);
        });
        console.log(`📢 Notified ${adminIds.length} admin(s) of new report for booking ${booking._id}`);
      }
    } catch (notificationError) {
      console.error("Error sending admin notification for new report:", notificationError);
      // Do not fail the request if notification fails
    }

    // Repopulate to ensure the frontend gets the full object for optimistic updates
    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate({
        path: 'vendor',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate('service', 'title category pricing')
      .populate({
        path: 'dispute.raisedBy',
        model: 'User',
        select: 'name role'
      });

    res.status(200).json(updatedBooking);
  } catch (error) {
    console.error("Error reporting issue:", error);
    res.status(500).json({ error: 'Server error while reporting issue.' });
  }
});

// Add rating and review
router.post('/:id/review', async (req, res) => {
  try {
    const { score, review } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Corrected check: Ensure the user is the customer for this booking
    if (!booking.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the customer who made the booking can leave a review.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed services.' });
    }

    // Prevent submitting more than one review
    if (booking.rating && booking.rating.score) {
      return res.status(400).json({ error: 'A review for this booking has already been submitted.' });
    }

    booking.rating = {
      score,
      review,
      date: new Date()
    };

    await booking.save();

    // After saving the review, recalculate the vendor's average rating
    const vendor = await Vendor.findById(booking.vendor);
    if (vendor) {
      const stats = await Booking.aggregate([
        { $match: { vendor: vendor._id, status: 'completed', 'rating.score': { $exists: true } } },
        { 
          $group: { 
            _id: '$vendor', 
            average: { $avg: '$rating.score' },
            count: { $sum: 1 }
          } 
        }
      ]);

      if (stats.length > 0) {
        await User.findByIdAndUpdate(vendor.user, {
          'ratings.average': stats[0].average,
          'ratings.count': stats[0].count
        });
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;