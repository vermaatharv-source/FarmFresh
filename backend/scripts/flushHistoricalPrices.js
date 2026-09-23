/**
 * One-time cleanup: delete every inactive GradePriceConfig document.
 * Run after deploying the "no historical prices" change:
 *
 *   node scripts/flushHistoricalPrices.js
 *
 * Requires MONGO_URI in backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const GradePriceConfig = require('../models/GradePriceConfig');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const result = await GradePriceConfig.deleteMany({ isActive: false });
  console.log(`Deleted ${result.deletedCount} historical (inactive) grade price row(s).`);
  await mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
