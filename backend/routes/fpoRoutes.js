const express = require('express');
const router = express.Router();
const {
  registerFpo,
  getFpoProfile,
  uploadKyc,
  addStaff,
  addFarmer,
  getFarmers,
  toggleFarmerStatus,
  toggleFarmerVerification,
  getFarmerDetail,
  importFarmersCsv,
  createBatchIntake,
  gradeBatch,
  getBatches,
  getInventory,
  getStockMovements,
  getLowStockAlerts,
  createPayout,
  getPayouts,
  getAnalytics,
  getBatchTraceability,
} = require('../controllers/fpoController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const upload = require('../middleware/upload');

// 1. FPO Profile & Management
router.get('/profile', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getFpoProfile);
router.post('/register', protect, authorizeRoles('fpo_admin'), registerFpo);
router.post('/kyc', protect, authorizeRoles('fpo_admin'), upload.array('documents', 5), uploadKyc);
router.post('/staff', protect, authorizeRoles('fpo_admin'), addStaff);

// 2. Farmer Management
router.get('/farmers', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getFarmers);
router.post('/farmers', protect, authorizeRoles('fpo_admin', 'fpo_staff'), addFarmer);
router.get('/farmers/:farmerId', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getFarmerDetail);
router.patch('/farmers/:farmerId/status', protect, authorizeRoles('fpo_admin', 'fpo_staff'), toggleFarmerStatus);
router.patch('/farmers/:farmerId/verify', protect, authorizeRoles('fpo_admin', 'fpo_staff'), toggleFarmerVerification);
router.post('/farmers/import-csv', protect, authorizeRoles('fpo_admin', 'fpo_staff'), upload.single('file'), importFarmersCsv);

// 3. Produce Intake & Batch Grading
router.get('/batches', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getBatches);
router.post('/batches/intake', protect, authorizeRoles('fpo_admin', 'fpo_staff'), createBatchIntake);
router.patch('/batches/:batchId/grade', protect, authorizeRoles('fpo_admin', 'fpo_staff'), upload.array('qualityImages', 5), gradeBatch);

// 4. Inventory & Payouts
router.get('/inventory', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getInventory);
router.get('/inventory/movements', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getStockMovements);
router.get('/inventory/low-stock', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getLowStockAlerts);
router.get('/payouts', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getPayouts);
router.post('/payouts', protect, authorizeRoles('fpo_admin'), createPayout);

// 5. Analytics
router.get('/analytics', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getAnalytics);

// 6. Dynamic Param Routes (MUST BE PLACED LAST)
router.get('/trace/:batchId', getBatchTraceability);

module.exports = router;
