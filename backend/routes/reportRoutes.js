const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getFarmerPerformance,
  getMonthlyReport,
  getSettlement,
  downloadPayoutReport,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/sales', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getSalesReport);
router.get('/farmer-performance', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getFarmerPerformance);
router.get('/monthly', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getMonthlyReport);
router.get('/settlement', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getSettlement);
router.get('/payouts/download', protect, authorizeRoles('fpo_admin', 'fpo_staff'), downloadPayoutReport);

module.exports = router;
