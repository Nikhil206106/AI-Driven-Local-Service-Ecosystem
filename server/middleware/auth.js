import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];    
    const token = authHeader && authHeader.split(' ')[1];    

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables.');
    }
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId);


    if (!user) {
      // This specific error helps the frontend understand the token is for a non-existent user.
      return res.status(401).json({ error: 'User for this token not found. Please log in again.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'This user account is inactive.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Token error:', error);
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};
export const admin = authorizeRole(['admin']);
