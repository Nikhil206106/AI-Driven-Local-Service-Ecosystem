import express from 'express';
import Message from '../models/Message.js';
import Booking from '../models/Booking.js';

const router = express.Router();

// Get all messages for a specific booking
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    // Security check: Ensure the current user is part of the booking
    const isCustomer = booking.customer.equals(req.user._id);
    const isVendor = booking.vendor?.user.equals(req.user._id);
    if (!isCustomer && !isVendor && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You are not part of this booking.' });
    }

    const messages = await Message.find({ booking: bookingId })
      .populate('sender', 'name profileImage role')
      .sort({ createdAt: 'asc' });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// Send a new message
router.post('/', async (req, res) => {
  try {
    const { bookingId, content, recipientId: adminRecipientId } = req.body;
    const senderId = req.user._id;

    const booking = await Booking.findById(bookingId).populate('customer').populate({
      path: 'vendor',
      populate: { path: 'user' }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    // Determine the recipient
    const isSenderVendor = booking.vendor?.user._id.equals(senderId);
    const isSenderCustomer = booking.customer._id.equals(senderId);
    let recipientId;

    if (req.user.role === 'admin') {
      if (!adminRecipientId) return res.status(400).json({ error: 'Admin must specify a recipientId.' });
      // Ensure admin is messaging a valid participant of the booking
      if (!booking.customer._id.equals(adminRecipientId) && !booking.vendor.user._id.equals(adminRecipientId)) {
        return res.status(403).json({ error: 'Admin can only message participants of the booking.' });
      }
      recipientId = adminRecipientId;
    } else if (isSenderCustomer) {
      recipientId = booking.vendor.user._id;
    } else if (isSenderVendor) {
      recipientId = booking.customer._id;
    } else {
      return res.status(403).json({ error: 'You are not authorized to send messages for this booking.' });
    }

    const message = new Message({
      booking: bookingId,
      sender: senderId,
      recipient: recipientId,
      content,
    });

    await message.save();

    // Emit a real-time event to the recipient
    req.io.to(recipientId.toString()).emit('receive-message', message);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

export default router;