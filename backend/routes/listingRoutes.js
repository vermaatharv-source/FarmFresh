const express = require('express');
const router = express.Router();
const { auditMiddleware } = require('../middleware/auditMiddleware');
router.use(auditMiddleware);
const c = require('../controllers/listingController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const upload = require('../middleware/upload');
const { requireVerifiedKycToPublish } = require('../middleware/kycMiddleware');

// Public routes
router.get('/public', c.getPublicListings);
router.get('/public/:id', c.getPublicListingById);

// FPO protected routes
router.get('/mine', protect, authorizeRoles('fpo_admin', 'fpo_staff'), c.getMyListings);
router.post('/', protect, authorizeRoles('fpo_admin', 'fpo_staff'), upload.array('images', 5), c.createListing);
router.patch('/:id/status', protect, authorizeRoles('fpo_admin', 'fpo_staff'), requireVerifiedKycToPublish, c.setListingStatus);
router.put('/:id', protect, authorizeRoles('fpo_admin', 'fpo_staff'), upload.array('images', 5), c.updateListing);
router.delete('/:id', protect, authorizeRoles('fpo_admin', 'fpo_staff'), c.deleteListing);

module.exports = router;