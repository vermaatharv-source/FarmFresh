const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const Notification = require('../models/Notification');

// Existing FPO Admin / Staff routes
router.get('/', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getNotifications);
router.patch('/:id/read', protect, authorizeRoles('fpo_admin', 'fpo_staff'), markNotificationRead);
router.patch('/read-all', protect, authorizeRoles('fpo_admin', 'fpo_staff'), markAllRead);

// Consumer / User Notification routes
router.get('/mine', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/mine/:id/read', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
    res.json({ notification, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/mine/read-all', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read', unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/mine/:id', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.findOneAndDelete({ _id: req.params.id, user: userId });
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
    res.json({ message: 'Notification dismissed', unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
