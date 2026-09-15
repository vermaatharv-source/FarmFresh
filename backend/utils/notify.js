const Notification = require('../models/Notification');

const notify = async (fpoId, type, message, meta = {}) => {
  try {
    await Notification.create({ fpo: fpoId, type, message, meta });
  } catch (err) {
    // Notifications are best-effort — never let a failed notification break
    // the actual business operation that triggered it.
    console.error('Failed to create notification:', err.message);
  }
};

module.exports = { notify };
