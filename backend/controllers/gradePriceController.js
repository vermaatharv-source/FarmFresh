const { toEnglish, sourceLangFromReq } = require('../utils/canonicalText');
const GradePriceConfig = require('../models/GradePriceConfig');
const Fpo = require('../models/Fpo');
const MandiPrice = require('../models/MandiPrice');
const AutoPricingRule = require('../models/Autopricingrule');
const { syncAgmarknetPrices } = require('../services/enamSyncService');
const { applyRule } = require('../services/Autopricingservice');

// Helper to escape special regex characters to prevent ReDoS
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper: resolve FPO ID for the logged-in user
const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

// Helper: Normalize crop names to canonical English
const normalizeCropName = async (cropName, req) => {
  if (!cropName || !String(cropName).trim()) return '';
  const sourceLang = sourceLangFromReq(req);
  try {
    const translated = await toEnglish(String(cropName).trim(), sourceLang);
    return String(translated || cropName).trim();
  } catch (err) {
    console.error('[canonicalText] Translation failed, falling back to original name:', err.message);
    return String(cropName).trim();
  }
};

// List grade price configs for this FPO.
exports.list = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const { cropName, includeInactive } = req.query;
    const filter = { fpo: fpoId };
    
    if (cropName) {
      filter.cropName = await normalizeCropName(cropName, req);
    }
    if (includeInactive !== 'true') filter.isActive = true;

    const configs = await GradePriceConfig.find(filter).sort({ cropName: 1, effectiveFrom: -1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Create a new grade price config.
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
      if (val === undefined || val === null || isNaN(Number(val)) || Number(val) < 0) {
        return res.status(400).json({ message: `${key} must be a valid non-negative number.` });
      }
    }

    if (referenceMarketPrice != null && (isNaN(Number(referenceMarketPrice)) || Number(referenceMarketPrice) < 0)) {
      return res.status(400).json({ message: 'referenceMarketPrice must be a non-negative number.' });
    }

    const cropNameEn = await normalizeCropName(cropName, req);

    // Flush previous price rows for this crop
    await GradePriceConfig.deleteMany({ fpo: fpoId, cropName: cropNameEn });

    const config = await GradePriceConfig.create({
      fpo: fpoId,
      cropName: cropNameEn,
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

// Update a config's prices in place
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
        if (isNaN(Number(val)) || Number(val) < 0) return res.status(400).json({ message: `${field} must be a non-negative number.` });
        config[field] = Number(val);
      }
    }
    
    if (referenceMarketPrice !== undefined) {
      if (isNaN(Number(referenceMarketPrice)) || Number(referenceMarketPrice) < 0) {
        return res.status(400).json({ message: 'referenceMarketPrice must be a non-negative number.' });
      }
      config.referenceMarketPrice = Number(referenceMarketPrice);
    }
    
    if (effectiveFrom !== undefined) config.effectiveFrom = new Date(effectiveFrom);
    config.updatedBy = userId;

    await config.save();
    res.json({ message: 'Grade price config updated.', config });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Permanently remove a grade price config
exports.deactivate = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const config = await GradePriceConfig.findOneAndDelete({ _id: req.params.id, fpo: fpoId });
    if (!config) return res.status(404).json({ message: 'Grade price config not found.' });

    res.json({ message: 'Grade price config removed.', config });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// List latest Mandi prices across commodities/states/markets
exports.listMandiPrices = async (req, res) => {
  try {
    let { commodity, state, limit } = req.query;

    if (commodity) commodity = await normalizeCropName(commodity, req);
    if (state) state = await normalizeCropName(state, req);

    const match = {};
    if (commodity) match.commodityName = new RegExp(escapeRegex(commodity.trim()), 'i');
    if (state) match.state = new RegExp(escapeRegex(state.trim()), 'i');

    const pipeline = [
      { $match: match },
      { $sort: { date: -1 } },       {$group: {
          _id: { commodityName: '$commodityName', state: '$state' },
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { commodityName: 1, state: 1 } },
    ];
    if (limit && !isNaN(Number(limit))) pipeline.push({ $limit: Number(limit) });

    const prices = await MandiPrice.aggregate(pipeline);
    res.json(prices);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Trigger manual sync of eNAM / Agmarknet market prices
exports.manualPriceSync = async (req, res) => {
  try {
    const result = await syncAgmarknetPrices();

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: `eNAM sync failed: ${result.message}`,
      });
    }

    res.status(200).json({
      success: true,
      message:
        result.updatedCount > 0
          ? `eNAM market prices synchronized successfully. ${result.updatedCount} records updated.`
          : 'Sync completed, but data.gov.in returned no records for today.',
      updatedCount: result.updatedCount,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to sync market prices.',
      error: error.message,
    });
  }
};

// Get latest Mandi reference price for a given crop/commodity
exports.getMandiReference = async (req, res) => {
  try {
    const { cropName, state, market } = req.query;

    if (!cropName) {
      return res.status(400).json({ message: 'cropName query parameter is required.' });
    }

    const normalizedCrop = await normalizeCropName(cropName, req);

    const filter = {
      commodityName: new RegExp(escapeRegex(normalizedCrop.trim()), 'i'),
    };
    if (state) filter.state = new RegExp(escapeRegex(state.trim()), 'i');
    if (market) filter.market = new RegExp(escapeRegex(market.trim()), 'i');

    let latestPrice = await MandiPrice.findOne(filter).sort({ date: -1 });

    if (!latestPrice) {
      console.log(`[eNAM Auto-Fetch] Mandi record for '${normalizedCrop}' missing in DB. Syncing from data.gov.in...`);
      await syncAgmarknetPrices();
      latestPrice = await MandiPrice.findOne(filter).sort({ date: -1 });
    }

    if (!latestPrice) {
      return res.status(404).json({
        message: `No live Mandi price data available for '${normalizedCrop}' in Agmarknet/eNAM records.`,
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

// List this FPO's auto-pricing rules
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

// Create or update the auto-pricing rule for one crop
exports.upsertAutoRule = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { cropName, gradeADiscountPct, gradeBDiscountPct, gradeCDiscountPct, isEnabled, state, market } = req.body;
    if (!cropName || !String(cropName).trim()) {
      return res.status(400).json({ message: 'cropName is required.' });
    }

    const normalizedCrop = await normalizeCropName(cropName, req);

    const rule = await AutoPricingRule.findOneAndUpdate(
      { fpo: fpoId, cropName: normalizedCrop },
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

// Enable/disable a rule
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

// Remove a rule entirely
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