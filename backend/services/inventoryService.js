const Listing = require('../models/Listing');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');

/**
 * UNIFIED INVENTORY SERVICE
 * -------------------------------------------------------------------------
 * Every code path that changes stock — direct order creation, unified
 * checkout, consumer cancellation, FPO cancellation, order rejection,
 * subscription fulfillment — MUST go through these functions instead of
 * hand-rolling `listing.availableQuantityKg +=/-= qty` in each controller.
 *
 * This fixes (Issue 5): inventory logic was previously duplicated and
 * inconsistent across order creation, consumer cancellation, FPO
 * cancellation, and refund flows, which is exactly how Issue 1 (stock not
 * restored on FPO-side cancellation) happened in the first place.
 *
 * Every function accepts an optional mongoose `session` so callers can run
 * a whole operation (validate -> decrement -> create order) as a single
 * atomic transaction (Issue 2).
 */

class InventoryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Throws if `listing` cannot currently satisfy `qty`. Used by BOTH
 * checkout/direct-order AND subscription creation (Issue 4) so the two
 * paths can never diverge again.
 */
function assertListingAvailable(listing, qty) {
  if (!listing) {
    throw new InventoryError('Listing not found or unavailable.', 404);
  }
  if (listing.status !== 'Published') {
    throw new InventoryError(`${listing.produceType || 'This listing'} is not currently published.`);
  }
  if (!qty || qty <= 0) {
    throw new InventoryError('Quantity must be greater than zero.');
  }
  if (qty < listing.minOrderQtyKg) {
    throw new InventoryError(`Minimum order for ${listing.produceType} is ${listing.minOrderQtyKg}kg.`);
  }
  if (listing.availableQuantityKg < qty) {
    throw new InventoryError(
      `Not enough stock for ${listing.produceType}. Only ${listing.availableQuantityKg}kg available.`
    );
  }
}

/**
 * Atomically decrements listing stock. The stock check and the decrement
 * happen as one DB write, so two concurrent checkouts can never oversell
 * the same listing. Throws if the stock disappeared between validation and
 * this call (race condition) so the caller's transaction can abort.
 */
async function decrementListingStock(listingId, qty, session) {
  const updated = await Listing.findOneAndUpdate(
    { _id: listingId, status: 'Published', availableQuantityKg: { $gte: qty } },
    { $inc: { availableQuantityKg: -qty } },
    { new: true, session }
  );
  if (!updated) {
    throw new InventoryError('Failed to secure stock for this listing (out of stock or no longer published).');
  }
  return updated;
}

/** Gives stock back to a listing (cancellation / rejection / rollback). */
async function restoreListingStock(listingId, qty, session) {
  return Listing.findByIdAndUpdate(
    listingId,
    { $inc: { availableQuantityKg: qty } },
    { new: true, session }
  );
}

async function getInventoryDoc(fpo, produceType, grade, session) {
  const query = Inventory.findOne({ fpo, produceType, grade });
  if (session) query.session(session);
  return query;
}

/** Moves Inventory from reserved -> sold when an order is placed. */
async function markInventorySold(fpo, produceType, grade, qty, session) {
  const inv = await getInventoryDoc(fpo, produceType, grade, session);
  if (!inv) return null;
  inv.reservedQuantity = Math.max(0, (inv.reservedQuantity || 0) - qty);
  inv.soldQuantity = (inv.soldQuantity || 0) + qty;
  await inv.save({ session });
  return inv;
}

/** Reverses a previous sale (cancellation / rejection / refund restock). */
async function markInventoryRestored(fpo, produceType, grade, qty, session) {
  const inv = await getInventoryDoc(fpo, produceType, grade, session);
  if (!inv) return null;
  inv.soldQuantity = Math.max(0, (inv.soldQuantity || 0) - qty);
  await inv.save({ session });
  return inv;
}

async function recordStockMovement(data, session) {
  const [doc] = await StockMovement.create([data], { session });
  return doc;
}

/**
 * Full "place an order" stock operation: decrement listing, move
 * Inventory reserved -> sold, and log a StockMovement row. Shared by
 * direct order creation and unified checkout so both apply the exact
 * same three side effects.
 */
async function applyOrderStock({ listing, qty, orderId, session }) {
  const updatedListing = await decrementListingStock(listing._id, qty, session);
  await markInventorySold(
    updatedListing.fpo,
    updatedListing.produceType,
    updatedListing.grade,
    qty,
    session
  );
  await recordStockMovement(
    {
      fpo: updatedListing.fpo,
      produceType: updatedListing.produceType,
      grade: updatedListing.grade,
      type: 'Sold',
      quantityKg: qty,
      listing: updatedListing._id,
      order: orderId,
    },
    session
  );
  return updatedListing;
}

/**
 * Full "give the stock back" operation. This is THE fix for Issue 1: it is
 * now called from every cancellation/rejection path (consumer cancel, FPO
 * cancel, FPO reject) instead of only from consumer cancellation, so a
 * cancelled/rejected order can never leave phantom stock deducted.
 *
 * Restores listing.availableQuantityKg, decrements Inventory.soldQuantity,
 * and writes a StockMovement row — the mirror image of applyOrderStock.
 * Safe to call even if the listing itself was later deleted.
 */
async function restoreOrderStock(order, { note = '' } = {}, session) {
  const query = Listing.findById(order.listing);
  if (session) query.session(session);
  const listing = await query;
  if (!listing) return null;

  const grade = order.gradeOrdered || listing.grade;

  await restoreListingStock(listing._id, order.quantityKg, session);
  await markInventoryRestored(order.fpo, listing.produceType, grade, order.quantityKg, session);
  await recordStockMovement(
    {
      fpo: order.fpo,
      produceType: listing.produceType,
      grade,
      type: 'Adjustment',
      quantityKg: order.quantityKg,
      listing: listing._id,
      order: order._id,
      note,
    },
    session
  );

  return listing;
}

module.exports = {
  InventoryError,
  assertListingAvailable,
  decrementListingStock,
  restoreListingStock,
  markInventorySold,
  markInventoryRestored,
  recordStockMovement,
  applyOrderStock,
  restoreOrderStock,
};
