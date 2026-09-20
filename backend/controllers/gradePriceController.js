const GradePriceConfig = require('../models/GradePriceConfig');
const Fpo = require('../models/Fpo');
const MandiPrice = require('../models/MandiPrice');
const AutoPricingRule = require('../models/Autopricingrule');
const { syncAgmarknetPrices } = require('../services/enamSyncService');
const { applyRule } = require('../services/Autopricingservice');

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

// List latest Mandi prices across commodities/states/markets, for a board/table view.
// Returns one (most recent) record per commodity+state combination so different
// mandis for the same crop are shown separately instead of being collapsed.
exports.listMandiPrices = async (req, res) => {
  try {
    const { commodity, state, limit } = req.query;
    const match = {};
    if (commodity) match.commodityName = new RegExp(commodity.trim(), 'i');
    if (state) match.state = new RegExp(state.trim(), 'i');

    const pipeline = [
      { $match: match },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: { commodityName: '$commodityName', state: '$state' },
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { commodityName: 1, state: 1 } },
    ];
    if (limit) pipeline.push({ $limit: Number(limit) });

    const prices = await MandiPrice.aggregate(pipeline);
    res.json(prices);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Trigger manual sync of eNAM / Agmarknet market prices
exports.manualPriceSync = async (req, res) => {
  try {
    await syncAgmarknetPrices();
    res.status(200).json({
      success: true,
      message: 'eNAM market prices synchronized successfully.',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to sync market prices.',
      error: error.message,
    });
  }
};

// Get latest Mandi reference price for a given crop/commodity (with automatic real-time fallback sync)
exports.getMandiReference = async (req, res) => {
  try {
    const { cropName, state, market } = req.query;

    if (!cropName) {
      return res.status(400).json({ message: 'cropName query parameter is required.' });
    }

    const filter = {
      commodityName: new RegExp(cropName.trim(), 'i'),
    };
    if (state) filter.state = new RegExp(state.trim(), 'i');
    if (market) filter.market = new RegExp(market.trim(), 'i');

    // 1. Check local MongoDB cache
    let latestPrice = await MandiPrice.findOne(filter).sort({ date: -1 });

    // 2. Automatic Fallback: If missing, perform an on-demand sync from eNAM API
    if (!latestPrice) {
      console.log(`[eNAM Auto-Fetch] Mandi record for '${cropName}' missing in DB. Syncing from data.gov.in...`);
      await syncAgmarknetPrices();
      latestPrice = await MandiPrice.findOne(filter).sort({ date: -1 });
    }

    if (!latestPrice) {
      return res.status(404).json({
        message: `No live Mandi price data available for '${cropName}' in Agmarknet/eNAM records.`,
      });
    }

    res.json({
      success: true,
      commodity: latestPrice.commodityName,
      state: latestPrice.state,
      market: latestPrice.market,
      minPrice: latestPrice.minPrice,
      modalPrice: latestPrice.modalPrice,
      maxPrice: latestPrice.maxPrice,
      date: latestPrice.date,
      source: latestPrice.source,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
// List this FPO's auto-pricing rules (which crops re-price themselves from mandi data)
exports.listAutoRules = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const rules = await AutoPricingRule.find({ fpo: fpoId }).sort({ cropName: 1 });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Create or update the auto-pricing rule for one crop, and apply it immediately
// (instead of waiting for the next cron sync) so the admin sees the effect now.
exports.upsertAutoRule = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { cropName, gradeADiscountPct, gradeBDiscountPct, gradeCDiscountPct, isEnabled, state, market } = req.body;
    if (!cropName || !String(cropName).trim()) {
      return res.status(400).json({ message: 'cropName is required.' });
    }

    const rule = await AutoPricingRule.findOneAndUpdate(
      { fpo: fpoId, cropName: cropName.trim() },
      {
        $set: {
          gradeADiscountPct: gradeADiscountPct != null ? Number(gradeADiscountPct) : 0,
          gradeBDiscountPct: gradeBDiscountPct != null ? Number(gradeBDiscountPct) : 15,
          gradeCDiscountPct: gradeCDiscountPct != null ? Number(gradeCDiscountPct) : 30,
          isEnabled: isEnabled !== false,
          state: state || undefined,
          market: market || undefined,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { new: true, upsert: true }
    );

    // Force an immediate re-apply even if the modal price hasn't moved since
    // last run — the admin just changed the discount %, so the old "no
    // change" guard shouldn't block this one-off apply.
    rule.lastAppliedModalPrice = undefined;
    const applied = await applyRule(rule);

    res.status(201).json({
      message: applied
        ? 'Auto-pricing rule saved and applied from the latest mandi rate.'
        : 'Auto-pricing rule saved. No live mandi price for this crop yet — it will apply on the next sync.',
      rule,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Enable/disable a rule without touching its discount %s
exports.toggleAutoRule = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const rule = await AutoPricingRule.findOne({ _id: req.params.id, fpo: fpoId });
    if (!rule) return res.status(404).json({ message: 'Auto-pricing rule not found.' });

    rule.isEnabled = req.body.isEnabled !== undefined ? !!req.body.isEnabled : !rule.isEnabled;
    rule.updatedBy = userId;
    await rule.save();

    res.json({ message: `Auto-pricing ${rule.isEnabled ? 'enabled' : 'paused'} for ${rule.cropName}.`, rule });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Remove a rule entirely — the crop goes back to being priced manually.
// The last GradePriceConfig it produced is left in place/history untouched.
exports.deleteAutoRule = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const rule = await AutoPricingRule.findOneAndDelete({ _id: req.params.id, fpo: fpoId });
    if (!rule) return res.status(404).json({ message: 'Auto-pricing rule not found.' });

    res.json({ message: `Auto-pricing removed for ${rule.cropName} — pricing is manual again.` });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};