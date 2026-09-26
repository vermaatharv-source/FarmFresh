const axios = require('axios');
const cron = require('node-cron');
const MandiPrice = require('../models/MandiPrice');
const { applyAutoPricingRules } = require('./Autopricingservice');

/**
 * api.data.gov.in (which serves the Agmarknet/eNAM Mandi price dataset) is
 * known to intermittently return a bare HTML 502/504 gateway-error page
 * instead of JSON. Previously that HTML was fetched with no timeout, no
 * retry, and no check that the body was actually JSON — so a single
 * transient blip meant "no prices today" until the next 1:00 AM cron run.
 *
 * Fix: retry transient failures a few times with backoff, and explicitly
 * detect an HTML/non-JSON body so it's reported clearly instead of dumped
 * as a wall of markup.
 */

const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const BASE_BACKOFF_MS = 2_000; // 2s, 4s, 8s...

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// data.gov.in's gateway errors come back as an HTML body with a 200-range
// axios "success" in some edge cases, or as a non-JSON 5xx. Either way,
// response.data will be a string of HTML rather than a parsed object.
const isHtmlErrorPage = (data) =>
  typeof data === 'string' && /<html|<title>\d{3} /i.test(data);

const isRetryableError = (error) => {
  // Network-level errors (no response at all): timeout, DNS, connection reset.
  if (!error.response) return true;
  const status = error.response.status;
  // 5xx (bad/upstream gateway, service unavailable, timeout) are worth retrying.
  if (status >= 500) return true;
  return false;
};

async function fetchMandiRecords() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(process.env.ENAM_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: {
          'api-key': process.env.ENAM_API_KEY,
          format: 'json',
          limit: 500,
        },
        // Let us inspect non-2xx bodies ourselves instead of axios always
        // throwing straight into the generic catch block below.
        validateStatus: () => true,
      });

      if (isHtmlErrorPage(response.data)) {
        const statusLine = response.data.match(/<title>(.*?)<\/title>/i)?.[1] || `HTTP ${response.status}`;
        throw Object.assign(new Error(`data.gov.in returned a gateway error page (${statusLine})`), {
          response,
          isGatewayHtml: true,
        });
      }

      if (response.status >= 400) {
        throw Object.assign(new Error(`data.gov.in responded with HTTP ${response.status}`), { response });
      }

      return response.data?.records || [];
    } catch (error) {
      lastError = error;
      const retryable = error.isGatewayHtml || isRetryableError(error);

      if (!retryable || attempt === MAX_ATTEMPTS) {
        break;
      }

      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      console.warn(
        `[eNAM Sync] Attempt ${attempt}/${MAX_ATTEMPTS} failed (${error.message}). Retrying in ${backoff / 1000}s...`
      );
      await sleep(backoff);
    }
  }

  throw lastError;
}

/**
 * Fetches today's Mandi market prices from data.gov.in and updates MandiPrice records.
 */
const syncAgmarknetPrices = async () => {
  try {
    console.log('[eNAM Sync] Fetching daily Mandi market prices...');

    const records = await fetchMandiRecords();

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
    if (error.isGatewayHtml) {
      console.error(
        `[eNAM Sync Error]: data.gov.in gateway is down/unreachable after ${MAX_ATTEMPTS} attempts (${error.message}). Will retry on the next scheduled sync.`
      );
    } else {
      console.error('[eNAM Sync Error]:', error.response?.data || error.message);
    }
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