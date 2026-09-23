const { verifyAuditChain } = require('../services/blockchainAuditService');

exports.verifyAuditLedger = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Only authority admin can verify the audit ledger.' });
    }
    const result = await verifyAuditChain();
    return res.status(result.valid ? 200 : 409).json({
      ledger: 'FarmFresh internal tamper-evident audit blockchain',
      ...result,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to verify audit ledger.' });
  }
};
