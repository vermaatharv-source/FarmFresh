const GradePriceConfig = require('../models/GradePriceConfig');
const Fpo = require('../models/Fpo');

// Helper: resolve FPO ID for the logged-in user (mirrors fpoController's helper)
const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

// List all grade price configs for this FPO (most recent first)
exports.list = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const { cropName, activeOnly } = req.query;
    const filter = { fpo: fpoId };
    if (cropName) filter.cropName = cropName;
    if (activeOnly === 'true') filter.isActive = true;

    const configs = await GradePriceConfig.find(filter).sort({ cropName: 1, effectiveFrom: -1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Create a new grade price config. Any existing active config for the same
// crop is deactivated so batch grading always resolves a single active price.
exports.create = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { cropName, gradeAPricePerKg, gradeBPricePerKg, gradeCPricePerKg, referenceMarketPrice, effectiveFrom } = req.body;

    if (!cropName || !String(cropName).trim()) {
      return res.status(400).json({ message: 'cropName is required.' });
    }
    const prices = { gradeAPricePerKg, gradeBPricePerKg, gradeCPricePerKg };
    for (const [key, val] of Object.entries(prices)) {
      if (val === undefined || val === null || Number(val) < 0) {
        return res.status(400).json({ message: `${key} must be a valid non-negative number.` });
      }
    }

    await GradePriceConfig.updateMany(
      { fpo: fpoId, cropName: cropName.trim(), isActive: true },
      { $set: { isActive: false, updatedBy: userId } }
    );

    const config = await GradePriceConfig.create({
      fpo: fpoId,
      cropName: cropName.trim(),
      gradeAPricePerKg: Number(gradeAPricePerKg),
      gradeBPricePerKg: Number(gradeBPricePerKg),
      gradeCPricePerKg: Number(gradeCPricePerKg),
      referenceMarketPrice: referenceMarketPrice != null ? Number(referenceMarketPrice) : 0,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });

    res.status(201).json({ message: 'Grade price config created and set as active.', config });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Update a config's prices in place (does not change isActive or cropName)
exports.update = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const config = await GradePriceConfig.findOne({ _id: req.params.id, fpo: fpoId });
    if (!config) return res.status(404).json({ message: 'Grade price config not found.' });

    const { gradeAPricePerKg, gradeBPricePerKg, gradeCPricePerKg, referenceMarketPrice, effectiveFrom } = req.body;

    for (const [field, val] of [['gradeAPricePerKg', gradeAPricePerKg], ['gradeBPricePerKg', gradeBPricePerKg], ['gradeCPricePerKg', gradeCPricePerKg]]) {
      if (val !== undefined) {
        if (Number(val) < 0) return res.status(400).json({ message: `${field} must be a non-negative number.` });
        config[field] = Number(val);
      }
    }
    if (referenceMarketPrice !== undefined) config.referenceMarketPrice = Number(referenceMarketPrice);
    if (effectiveFrom !== undefined) config.effectiveFrom = new Date(effectiveFrom);
    config.updatedBy = userId;

    await config.save();
    res.json({ message: 'Grade price config updated.', config });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Deactivate a config (soft delete — keeps history for batches already priced from it)
exports.deactivate = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const config = await GradePriceConfig.findOne({ _id: req.params.id, fpo: fpoId });
    if (!config) return res.status(404).json({ message: 'Grade price config not found.' });

    config.isActive = false;
    config.updatedBy = userId;
    await config.save();

    res.json({ message: 'Grade price config deactivated.', config });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
