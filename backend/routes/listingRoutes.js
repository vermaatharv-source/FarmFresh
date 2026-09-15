const express = require('express');
const router = express.Router();
const {
  createListing,
  getMyListings,
  getPublicListings,
  setListingStatus,
  updateListing,
  deleteListing,
} = require('../controllers/listingController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const upload = require('../middleware/upload');

// Public — consumer-facing marketplace, no login required
router.get('/public', getPublicListings);

// FPO-only management
router.get('/mine', protect, authorizeRoles('fpo_admin', 'fpo_staff'), getMyListings);
router.post('/', protect, authorizeRoles('fpo_admin', 'fpo_staff'), upload.array('images', 5), createListing);
router.patch('/:id/status', protect, authorizeRoles('fpo_admin', 'fpo_staff'), setListingStatus);
router.put('/:id', protect, authorizeRoles('fpo_admin', 'fpo_staff'), updateListing);
router.delete('/:id', protect, authorizeRoles('fpo_admin', 'fpo_staff'), deleteListing);

module.exports = router;
