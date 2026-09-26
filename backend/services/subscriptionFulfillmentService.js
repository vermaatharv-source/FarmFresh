const cron = require('node-cron');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const { assertListingAvailable, applyOrderStock } = require('./inventoryService');
const { notifyUser, notify } = require('../utils/notify');

/**
 * Fix (Issue 3): subscriptions previously only had create / pause / resume /
 * cancel / skip / nextDeliveryDate — nothing ever turned nextDeliveryDate
 * into an actual order. This module is the missing engine:
 *
 *   nextDeliveryDate is due -> validate live stock -> create an FpoOrder
 *   -> decrement stock via the unified inventory service -> advance
 *   nextDeliveryDate to the following occurrence
 *
 * It reuses applyOrderStock() from inventoryService.js, the same function
 * checkout and direct-order use, so a subscription delivery is
 * indistinguishable — from a stock-accounting point of view — from a
 * manually placed order.
 *
 * If the listing can't currently satisfy the subscription (paused,
 * unpublished, insufficient stock — Issue 4's live-inventory problem
 * surfacing at delivery time instead of at creation time), the delivery
 * is skipped, the consumer is notified, and nextDeliveryDate is retried
 * the next day rather than silently dropped or silently advanced a full
 * cycle.
 */

const advanceDateByFrequency = (date, frequency) => {
  const base = new Date(date);
  let days = 7;
  if (frequency === 'BiWeekly') days = 14;
  if (frequency === 'Monthly') days = 28;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
};

const RETRY_TOMORROW_MS = 24 * 60 * 60 * 1000;

/**
 * Fulfils a single due subscription: creates the order + deducts stock in
 * one transaction, then advances (or retries) nextDeliveryDate outside the
 * transaction so a notification failure never rolls back a real order.
 */
async function fulfillOneSubscription(subscription) {
  const session = await mongoose.startSession();
  let outcome;

  try {
    await session.withTransaction(async () => {
      const listing = await Listing.findById(subscription.listing).session(session);

      try {
        assertListingAvailable(listing, subscription.quantityKg);
      } catch (e) {
        outcome = { ok: false, reason: e.message };
        return; // leave the transaction with nothing written
      }

      const created = await FpoOrder.create(
        [
          {
            fpo: listing.fpo,
            listing: listing._id,
            consumer: subscription.consumer,
            quantityKg: subscription.quantityKg,
            totalPrice: subscription.finalPricePerDelivery,
            buyerType: 'INDIVIDUAL',
            gradeOrdered: listing.grade,
            status: 'Placed',
            deliveryAddress: subscription.deliveryAddress,
            deliverySlot: subscription.deliverySlot,
            paymentMethod: subscription.paymentMethod,
          },
        ],
        { session }
      );
      const order = created[0];

      await applyOrderStock({ listing, qty: subscription.quantityKg, orderId: order._id, session });

      outcome = { ok: true, order, fpo: listing.fpo, produceName: listing.produceType };
    });
  } finally {
    await session.endSession();
  }

  if (!outcome.ok) {
    // Don't advance a full cycle on a failed delivery — retry tomorrow so a
    // temporary stockout doesn't cost the subscriber a whole week/month.
    subscription.nextDeliveryDate = new Date(Date.now() + RETRY_TOMORROW_MS);
    await subscription.save();

    await notifyUser(
      subscription.consumer,
      'System',
      `We couldn't fulfil your ${subscription.produceName} subscription delivery today (${outcome.reason}). We'll retry tomorrow.`,
      { subscriptionId: subscription._id }
    ).catch(() => {});
    return outcome;
  }

  subscription.lastDeliveredDate = new Date();
  subscription.deliveriesCompleted = (subscription.deliveriesCompleted || 0) + 1;
  subscription.nextDeliveryDate = advanceDateByFrequency(subscription.nextDeliveryDate, subscription.frequency);
  await subscription.save();

  await notifyUser(
    subscription.consumer,
    'OrderAccepted',
    `Your ${subscription.produceName} subscription delivery has been placed (Order #${outcome.order._id.toString().slice(-6).toUpperCase()}).`,
    { orderId: outcome.order._id, subscriptionId: subscription._id }
  ).catch(() => {});

  await notify(
    outcome.fpo,
    'NewOrder',
    `New recurring subscription order: ${subscription.quantityKg}kg ${subscription.produceName}.`,
    { orderId: outcome.order._id }
  ).catch(() => {});

  return outcome;
}

/**
 * Runs the fulfillment sweep: every Active subscription whose
 * nextDeliveryDate has arrived gets processed one at a time (sequential on
 * purpose — keeps load predictable and avoids many concurrent transactions
 * fighting over the same listings).
 */
async function runSubscriptionFulfillment() {
  const due = await Subscription.find({
    status: 'Active',
    nextDeliveryDate: { $lte: new Date() },
  });

  if (due.length === 0) {
    console.log('[Subscription Fulfillment] No subscriptions due.');
    return { processed: 0, fulfilled: 0, skipped: 0 };
  }

  let fulfilled = 0;
  let skipped = 0;

  for (const subscription of due) {
    try {
      const outcome = await fulfillOneSubscription(subscription);
      if (outcome.ok) fulfilled += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      console.error(`[Subscription Fulfillment] Failed for subscription ${subscription._id}:`, err.message);
    }
  }

  console.log(`[Subscription Fulfillment] Processed ${due.length} due subscription(s): ${fulfilled} fulfilled, ${skipped} skipped/retried.`);
  return { processed: due.length, fulfilled, skipped };
}

/**
 * Starts the daily automated subscription fulfillment run. Scheduled for
 * 6:00 AM daily, ahead of the "Morning (6:00 AM - 9:00 AM)" delivery slot
 * subscriptions default to.
 */
function initSubscriptionFulfillmentScheduler() {
  cron.schedule('0 6 * * *', () => {
    runSubscriptionFulfillment().catch((err) =>
      console.error('[Subscription Fulfillment] Scheduled run failed:', err.message)
    );
  });
  console.log('[Subscription Fulfillment] Cron scheduler registered (runs daily at 6:00 AM).');
}

module.exports = {
  runSubscriptionFulfillment,
  initSubscriptionFulfillmentScheduler,
};
