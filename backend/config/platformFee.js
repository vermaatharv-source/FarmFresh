// Platform fee settings.
// PLATFORM_FEE_PERCENT (env) overrides the default 30%.
// PLATFORM_FEE_MODE:
//   ADD_ON  (default) -> consumer pays order amount + fee. FPO gets 100% of the order amount, platform gets the fee.
//   DEDUCT            -> consumer pays only the order amount. FPO gets order amount - fee, platform gets the fee.
const DEFAULT_PERCENT = 30;

function parsePercent(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_PERCENT;
  const n = Number(raw);
  // Reject NaN / negative / above 100 so a bad ENV value can never break checkout.
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_PERCENT;
  return n;
}

const PERCENT = parsePercent(process.env.PLATFORM_FEE_PERCENT);
const MODE = String(process.env.PLATFORM_FEE_MODE || 'ADD_ON').toUpperCase() === 'DEDUCT' ? 'DEDUCT' : 'ADD_ON';

const round2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

// orderAmount = the order value after discount (what the FPO's produce is priced at).
function calculateSplit(orderAmount) {
  const amount = Math.max(0, round2(orderAmount));
  const platformFee = round2((amount * PERCENT) / 100);
  if (MODE === 'DEDUCT') {
    return { orderAmount: amount, platformFee, fpoAmount: round2(amount - platformFee), totalCharged: amount, percent: PERCENT, mode: MODE };
  }
  return { orderAmount: amount, platformFee, fpoAmount: amount, totalCharged: round2(amount + platformFee), percent: PERCENT, mode: MODE };
}

module.exports = { PLATFORM_FEE_PERCENT: PERCENT, PLATFORM_FEE_MODE: MODE, calculateSplit, round2 };