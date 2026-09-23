const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { verifyAuditLedger } = require('../controllers/securityController');

router.get('/audit-ledger/verify', protect, authorizeRoles('admin'), verifyAuditLedger);

module.exports = router;
