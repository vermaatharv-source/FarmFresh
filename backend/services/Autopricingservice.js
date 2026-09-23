const AutoPricingRule = require('../models/Autopricingrule');
const MandiPrice = require('../models/MandiPrice');
const GradePriceConfig = require('../models/GradePriceConfig');

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Applies one auto-pricing rule: looks up the latest matching mandi price,
 * converts ₹/quintal -> ₹/kg, applies the per-grade discount %, and replaces
 * the FPO's GradePriceConfig for that crop.
 *
 * Previous configs for the same (fpo, cropName) are DELETED (not soft-deactivated)
 * so the UI and DB never accumulate historical price rows.
 *
 * Skips silently — returns false — if there's no mandi data yet, or the modal
 * price hasn't changed since the last apply (avoids needless churn).
 */
const applyRule = async (rule) => {
  if (!rule.isEnabled) return false;

  const filter = { commodityName: new RegExp(`^${rule.cropName}$`, 'i') };
  if (rule.state) filter.state = new RegExp(rule.state, 'i');
  if (rule.market) filter.market = new RegExp(rule.market, 'i');

  const latest = await MandiPrice.findOne(filter).sort({ date: -1 });
  if (!latest || latest.modalPrice == null) return false;
  if (rule.lastAppliedModalPrice === latest.modalPrice) return false;

  const basePerKg = latest.modalPrice / 100;
  const gradeAPricePerKg = round2(basePerKg * (1 - (rule.gradeADiscountPct || 0) / 100));
  const gradeBPricePerKg = round2(basePerKg * (1 - (rule.gradeBDiscountPct || 0) / 100));
  const gradeCPricePerKg = round2(basePerKg * (1 - (rule.gradeCDiscountPct || 0) / 100));

  // Flush all previous price rows for this crop (active + historical).
  await GradePriceConfig.deleteMany({ fpo: rule.fpo, cropName: rule.cropName });

  await GradePriceConfig.create({
    fpo: rule.fpo,
    cropName: rule.cropName,
    gradeAPricePerKg,
    gradeBPricePerKg,
    gradeCPricePerKg,
    referenceMarketPrice: round2(basePerKg),
    effectiveFrom: new Date(),
    isActive: true,
    pricingSource: 'AUTO_MANDI',
    updatedBy: rule.updatedBy,
  });

  rule.lastAppliedAt = new Date();
  rule.lastAppliedModalPrice = latest.modalPrice;
  await rule.save();
  return true;
};

/** Applies every enabled rule across every FPO. Called after each mandi sync. */
const applyAutoPricingRules = async () => {
  const rules = await AutoPricingRule.find({ isEnabled: true });
  let applied = 0;
  for (const rule of rules) {
    try {
      if (await applyRule(rule)) applied += 1;
    } catch (err) {
      console.error(`[Auto Pricing] Failed for rule ${rule._id} (${rule.cropName}):`, err.message);
    }
  }
  if (rules.length) {
    console.log(`[Auto Pricing] Re-priced ${applied}/${rules.length} enabled crop rule(s).`);
  }
  return { applied, total: rules.length };
};

/**
 * One-shot cleanup: remove every inactive (historical) GradePriceConfig
 * across all FPOs. Safe to run after deploying the no-history policy.
 */
const flushHistoricalPrices = async () => {
  const result = await GradePriceConfig.deleteMany({ isActive: false });
  return { deleted: result.deletedCount || 0 };
};

module.exports = { applyRule, applyAutoPricingRules, flushHistoricalPrices };
