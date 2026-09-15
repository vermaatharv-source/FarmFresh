const Fpo = require('../models/Fpo');
const Notification = require('../models/Notification');

const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const notifications = await Notification.find({ fpo: fpoId }).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, fpo: fpoId },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    await Notification.updateMany({ fpo: fpoId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
