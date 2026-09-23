const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies Bearer JWT and attaches a fresh user snapshot to req.user.
 * Rejects missing/invalid tokens and accounts that no longer exist.
 * Role is refreshed from the database so demotions take effect immediately.
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length > 2048) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Re-load user so deleted accounts and role changes take effect
    // without waiting for token expiry.
    const user = await User.findById(userId).select('_id role name email').lean();
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists. Please sign in again.' });
    }

    // Legacy farmer portal accounts cannot use the API.
    if (user.role === 'farmer') {
      return res.status(403).json({
        message: 'Farmer accounts are no longer supported. Please contact your FPO.',
      });
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please sign in again.' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { protect };
