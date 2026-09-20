const express = require('express');
const router = express.Router();
const { auditMiddleware } = require('../middleware/auditMiddleware');
const c = require('../controllers/gradePriceController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(auditMiddleware);
router.use(protect);

// List grade price configs for the logged-in FPO
router.get('/', authorizeRoles('fpo_admin', 'fpo_staff'), c.list);

// Live Mandi price reference lookup for auto-populating FPO grade configurations
router.get('/mandi-reference', authorizeRoles('fpo_admin', 'fpo_staff'), c.getMandiReference);

// Board view: latest synced Mandi prices across commodities/states
router.get('/mandi-prices', authorizeRoles('fpo_admin', 'fpo_staff'), c.listMandiPrices);

// Auto-pricing rules: crops that re-price themselves from mandi data on every sync
router.get('/auto-rules', authorizeRoles('fpo_admin', 'fpo_staff'), c.listAutoRules);
router.post('/auto-rules', authorizeRoles('fpo_admin'), c.upsertAutoRule);
router.patch('/auto-rules/:id/toggle', authorizeRoles('fpo_admin'), c.toggleAutoRule);
router.delete('/auto-rules/:id', authorizeRoles('fpo_admin'), c.deleteAutoRule);

// Manual trigger endpoint for eNAM sync
router.post('/sync', authorizeRoles('fpo_admin'), c.manualPriceSync);

// Config CRUD routes
router.post('/', authorizeRoles('fpo_admin'), c.create);
router.put('/:id', authorizeRoles('fpo_admin'), c.update);
router.patch('/:id/deactivate', authorizeRoles('fpo_admin'), c.deactivate);

module.exports = router;