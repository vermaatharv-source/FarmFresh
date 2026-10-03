const express = require('express');
const router = express.Router();
const growthController = require('../controllers/growthController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Public
router.get('/listings/nearby', growthController.getNearbyListings);
router.get('/share/listing/:id', growthController.getShareableListing);

// Authenticated
router.get('/referral/me', protect, growthController.getMyReferralCode);
router.get('/wallet', protect, growthController.getWallet);
router.post('/coupon/validate', protect, growthController.validateCoupon);
router.get('/coupons/available', protect, growthController.getAvailableCoupons);
router.put('/me/location', protect, growthController.updateMyLocation);
router.get('/demand-signals', protect, growthController.getDemandSignals);
router.put('/fpo/location', protect, authorizeRoles('fpo_admin'), growthController.updateFpoLocation);
router.post('/delivery-check', protect, growthController.deliveryCheck);
router.get('/fpo/buyers-demand', protect, authorizeRoles('fpo_admin', 'fpo_staff'), growthController.getFpoBuyersDemand);

module.exports = router;
