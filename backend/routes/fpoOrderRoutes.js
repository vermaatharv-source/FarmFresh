const express = require('express');
const router = express.Router();
const {
  createOrder,
  getFpoOrders,
  getMyOrders,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/fpoOrderController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Consumer
router.post('/', protect, authorizeRoles('consumer'), createOrder);
router.get('/mine', protect, authorizeRoles('consumer'), getMyOrders);

// FPO
router.get('/fpo', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getFpoOrders);
router.patch('/:id/status', protect, authorizeRoles('fpo_admin', 'fpo_staff'), updateOrderStatus);
router.patch('/:id/cancel', protect, authorizeRoles('fpo_admin', 'fpo_staff'), cancelOrder);

module.exports = router;
