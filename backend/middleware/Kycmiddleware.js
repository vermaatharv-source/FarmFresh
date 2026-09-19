const Fpo = require('../models/Fpo');

// KYC gating is switched on with ENFORCE_KYC=true in backend/.env.
// When it is off (default), every FPO can work normally, which keeps local
// development and demos unblocked.
const isEnforced = () => String(process.env.ENFORCE_KYC || '').toLowerCase() === 'true';

const requireVerifiedKyc = async (req, res, next) => {
  if (!isEnforced()) return next();
  try {
    const uid = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ $or: [{ adminUser: uid }, { staff: uid }] })
      .select('kycStatus kycRejectionReason');
    if (!fpo) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }
    if (fpo.kycStatus !== 'Verified') {
      const reason = fpo.kycStatus === 'Rejected' && fpo.kycRejectionReason
        ? ` Reason: ${fpo.kycRejectionReason}`
        : '';
      return res.status(403).json({
        message: `This action requires a KYC-verified FPO. Current KYC status: ${fpo.kycStatus}.${reason}`,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Only publishing a listing needs verification; drafting and pausing do not.
const requireVerifiedKycToPublish = (req, res, next) =>
  req.body && req.body.status === 'Published' ? requireVerifiedKyc(req, res, next) : next();

module.exports = { requireVerifiedKyc, requireVerifiedKycToPublish };