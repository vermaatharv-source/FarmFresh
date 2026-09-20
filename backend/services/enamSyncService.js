const axios = require('axios');
const cron = require('node-cron');
const MandiPrice = require('../models/MandiPrice');
const { applyAutoPricingRules } = require('./Autopricingservice');

/**
 * Fetches today's Mandi market prices from data.gov.in and updates MandiPrice records.
 */
const syncAgmarknetPrices = async () => {
  try {
    console.log('[eNAM Sync] Fetching daily Mandi market prices...');

    const response = await axios.get(process.env.ENAM_API_URL, {
      params: {
        'api-key': process.env.ENAM_API_KEY,
        format: 'json',
        limit: 500,
      },
    });

    const records = response.data?.records || [];

    if (records.length === 0) {
      console.log('[eNAM Sync] No price records returned for today.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bulkOperations = records.map((record) => ({
      updateOne: {
        filter: {
          commodityName: record.commodity,
          state: record.state,
          market: record.market,
          date: today,
        },
        update: {
          $set: {
            commodityName: record.commodity,
            state: record.state,
            district: record.district,
            market: record.market,
            variety: record.variety,
            minPrice: Number(record.min_price) || 0,
            modalPrice: Number(record.modal_price) || 0,
            maxPrice: Number(record.max_price) || 0,
            source: 'Agmarknet/eNAM',
            date: today,
            lastSyncedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await MandiPrice.bulkWrite(bulkOperations);
    console.log(
      `[eNAM Sync] Success! Upserted/Updated ${result.upsertedCount + result.modifiedCount} commodity prices.`
    );

    // Cascade: recompute every FPO's auto-priced crops off the freshly synced rates.
    try {
      await applyAutoPricingRules();
    } catch (err) {
      console.error('[eNAM Sync] Auto-pricing cascade failed:', err.message);
    }
  } catch (error) {
    console.error('[eNAM Sync Error]:', error.response?.data || error.message);
  }
};

/**
 * Starts the daily automated sync at 01:00 AM.
 */
const initPriceSyncScheduler = () => {
  cron.schedule('0 1 * * *', () => {
    syncAgmarknetPrices();
  });
  console.log('[eNAM Sync] Cron scheduler registered (runs daily at 1:00 AM).');
};

module.exports = {
  syncAgmarknetPrices,
  initPriceSyncScheduler,
};