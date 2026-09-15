const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getNotifications);
router.patch('/:id/read', protect, authorizeRoles('fpo_admin', 'fpo_staff'), markNotificationRead);
router.patch('/read-all', protect, authorizeRoles('fpo_admin', 'fpo_staff'), markAllRead);

module.exports = router;
