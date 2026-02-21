import User from './models/User.js'; // Ensure this path is correct for your Mongoose User model
import mongoose from 'mongoose';

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Build search query based on name or email (case-insensitive regex search)
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } }, 
                { email: { $regex: search, $options: 'i' } }, 
            ];
        }

        // Fetch users, sorted by creation date (newest first)
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            // Selectively exclude password field for security
            .select('-password'); 

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
            users,
            currentPage: page,
            totalPages,
            totalUsers,
        });
    } catch (error) {
        console.error('Error fetching users (Admin):', error);
        res.status(500).json({ error: 'Server error while fetching users.' });
    }
};

// @desc    Update a user's role and status (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { role, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid User ID format.' });
    }

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        // SECURITY CHECK: Prevent an admin from changing their own role/status
        // req.user is populated by the `authenticateToken` middleware
        if (req.user && user._id.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: 'Cannot modify your own account status or role via this endpoint.' });
        }

        // Update role
        if (role) {
            // Validate against allowed roles
            if (!['customer', 'vendor', 'admin'].includes(role)) { 
                return res.status(400).json({ error: 'Invalid role provided.' });
            }
            user.role = role;
        }

        // Update activity status
        if (typeof isActive === 'boolean') {
            user.isActive = isActive;
        }

        await user.save();
        
        // Return the updated user object (Mongoose .toJSON() or .select('-password') prevents password exposure)
        res.status(200).json(user);

    } catch (error) {
        console.error('Error updating user (Admin):', error);
        res.status(500).json({ error: 'Server error while updating user.' });
    }
};

// @desc    Delete a user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid User ID format.' });
    }

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // SECURITY CHECK: Prevent an admin from deleting their own account
        if (req.user && user._id.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: 'You cannot delete your own admin account.' });
        }

        // Perform the deletion
        await User.findByIdAndDelete(id);

        res.status(200).json({ message: 'User deleted successfully.' });

    } catch (error) {
        console.error('Error deleting user (Admin):', error);
        res.status(500).json({ error: 'Server error while deleting user.' });
    }
};
