const crypto = require('crypto');

// System-generated transaction IDs (same idea as the auto batch number).
// Format: <PREFIX>-YYYYMMDD-XXXXXXXX  e.g. TXN-20260928-9F3A1C7B
// Prefixes: TXN = consumer payment, PAY = farmer payout, REF = refund.
const pad = (n) => String(n).padStart(2, '0');

function generateTransactionId(prefix = 'TXN') {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

module.exports = { generateTransactionId };
