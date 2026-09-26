const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const {
  InventoryError,
  assertListingAvailable,
  applyOrderStock,
  restoreOrderStock,
} = require('../services/inventoryService');
const { notify, notifyUser } = require('../utils/notify');

const getFpoId = async (userId) => {
  const f = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return f ? f._id : null;
};

// Buyer places order (supports buyerType for bulk buyers)
// Fix (Issue 2/5): validation + stock decrement + inventory update + order
// creation now run inside a single Mongo transaction via the unified
// inventory service, so a failure partway through rolls everything back
// instead of leaving stock decremented with no order to show for it.
exports.createOrder = async (req, res) => {
  const { listingId, quantityKg, buyerType = 'INDIVIDUAL' } = req.body;
  const qty = Number(quantityKg);

  if (!['INDIVIDUAL', 'RESTAURANT', 'KIRANA', 'WHOLESALER'].includes(buyerType)) {
    return res.status(400).json({ message: 'Invalid buyer type.' });
  }

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const existingListing = await Listing.findOne({ _id: listingId, status: 'Published' }).session(session);
      assertListingAvailable(existingListing, qty);

      // Create the order first, then apply the stock change referencing it.
      // If the stock decrement fails (e.g. a concurrent order just took the
      // last of it), the whole transaction — including this order doc —
      // is rolled back, so we never end up with an order that has no
      // matching stock movement or vice versa.
      const created = await FpoOrder.create(
        [
          {
            fpo: existingListing.fpo,
            listing: existingListing._id,
            consumer: req.user._id || req.user.id,
            quantityKg: qty,
            totalPrice: qty * existingListing.pricePerKg,
            buyerType,
            gradeOrdered: existingListing.grade,
            status: 'Placed',
          },
        ],
        { session }
      );
      order = created[0];

      const updatedListing = await applyOrderStock({ listing: existingListing, qty, orderId: order._id, session });

      req._listingForNotify = updatedListing;
    });
  } catch (e) {
    await session.endSession();
    const status = e instanceof InventoryError ? e.statusCode : e.statusCode && e.statusCode !== 500 ? e.statusCode : 500;
    return res.status(status).json({ message: e.message });
  }
  await session.endSession();

  const listing = req._listingForNotify;
  await notify(
    listing.fpo,
    'NewOrder',
    `New ${buyerType} order: ${qty}kg ${listing.produceType} Grade ${listing.grade}.`,
    { orderId: order._id }
  ).catch(() => {});

  await notifyUser(
    req.user._id || req.user.id,
    'OrderAccepted',
    `Your order for ${qty}kg ${listing.produceType} (Grade ${listing.grade}) has been placed!`,
    { orderId: order._id }
  ).catch(() => {});

  res.status(201).json(order);
};

// Buyer's own FPO orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await FpoOrder.find({ consumer: req.user._id || req.user.id })
      .populate('listing', 'produceType grade pricePerKg images sourceBatch sourceIntakeId')
      .populate('fpo', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// FPO side – all orders
exports.getFpoOrders = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    if (!f) return res.json([]);
    const orders = await FpoOrder.find({ fpo: f })
      .populate('listing', 'produceType grade pricePerKg images')
      .populate('consumer', 'name email location')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const transitions = {
  Placed: ['Accepted', 'Rejected', 'Cancelled'],
  Accepted: ['Packed', 'Cancelled'],
  Packed: ['Dispatched', 'Cancelled'],
  Dispatched: ['Delivered'],
  Delivered: [],
  Rejected: [],
  Cancelled: [],
  Refunded: [],
};

// Statuses at which stock has already been deducted from the listing and is
// still "out" — i.e. moving OUT of these statuses into a terminal
// Rejected/Cancelled state must restore stock. Packed/Dispatched are
// intentionally excluded from Rejected (rejection only makes sense before
// packing) but are included for Cancelled since the transitions map above
// still allows cancelling a Packed order.
const STOCK_HELD_STATUSES = ['Placed', 'Accepted', 'Packed'];

exports.updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const f = await getFpoId(req.user._id || req.user.id);
      const order = await FpoOrder.findOne({ _id: req.params.id, fpo: f }).session(session);
      if (!order) {
        const err = new Error('Order not found.');
        err.statusCode = 404;
        throw err;
      }

      const { status, rejectionReason } = req.body;
      if (!transitions[order.status]?.includes(status)) {
        const err = new Error(`Invalid transition ${order.status} → ${status}.`);
        err.statusCode = 400;
        throw err;
      }

      const previousStatus = order.status;

      if (status === 'Rejected') {
        order.rejectionReason = rejectionReason || '';
      }

      // Fix (Issue 1): rejecting an order used to just flip the status
      // without giving the reserved stock back to the listing. Now every
      // transition into Rejected/Cancelled restores stock through the
      // same unified service used by consumer cancellation.
      if (['Rejected', 'Cancelled'].includes(status) && STOCK_HELD_STATUSES.includes(previousStatus)) {
        await restoreOrderStock(
          order,
          { note: `FPO ${status.toLowerCase()} order (was ${previousStatus}): ${rejectionReason || req.body.reason || 'No reason provided'}` },
          session
        );
      }

      order.status = status;
      await order.save({ session });

      result = order;
    });

    const order = result;
    const orderShortId = order._id.toString().slice(-6).toUpperCase();
    let consumerMsg = '';
    let notificationType = 'System';

    if (order.status === 'Accepted') {
      notificationType = 'OrderAccepted';
      consumerMsg = `Your order #${orderShortId} has been confirmed by the FPO warehouse!`;
    } else if (order.status === 'Packed') {
      notificationType = 'OrderPacked';
      consumerMsg = `Order #${orderShortId} has passed quality grading and is packed in cold chain.`;
    } else if (order.status === 'Dispatched') {
      notificationType = 'OrderDispatched';
      consumerMsg = `Order #${orderShortId} is out for delivery! Estimated slot: ${order.deliverySlot || 'Standard Delivery'}.`;
    } else if (order.status === 'Delivered') {
      notificationType = 'OrderDelivered';
      consumerMsg = `Order #${orderShortId} has been delivered safely! Please rate your produce freshness.`;
    } else if (order.status === 'Rejected') {
      notificationType = 'OrderCancelled';
      consumerMsg = `Order #${orderShortId} could not be fulfilled: ${order.rejectionReason || 'Produce unavailable'}.`;
    } else if (order.status === 'Cancelled') {
      notificationType = 'OrderCancelled';
      consumerMsg = `Order #${orderShortId} was cancelled by the FPO.`;
    }

    if (consumerMsg) {
      await notifyUser(order.consumer, notificationType, consumerMsg, { orderId: order._id }).catch(() => {});
    }

    res.json(order);
  } catch (e) {
    res.status(e.statusCode || 500).json({ message: e.message });
  } finally {
    await session.endSession();
  }
};

// FPO-initiated cancellation.
// Fix (Issue 1): this previously flipped the order to `Cancelled` without
// restoring listing.availableQuantityKg, Inventory.soldQuantity, or
// writing a StockMovement row — the exact "stock leak" scenario described
// in the bug report. It now calls the same restoreOrderStock() used by
// consumer cancellation, inside a transaction alongside the status update.
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const f = await getFpoId(req.user._id || req.user.id);
      const order = await FpoOrder.findOne({ _id: req.params.id, fpo: f }).session(session);
      if (!order) {
        const err = new Error('Order not found.');
        err.statusCode = 404;
        throw err;
      }

      if (['Delivered', 'Refunded', 'Cancelled'].includes(order.status)) {
        const err = new Error('Cannot cancel this order.');
        err.statusCode = 400;
        throw err;
      }

      if (STOCK_HELD_STATUSES.includes(order.status)) {
        await restoreOrderStock(
          order,
          { note: `FPO cancelled order: ${req.body.reason || 'No reason provided'}` },
          session
        );
      }

      order.status = 'Cancelled';
      order.cancelReason = req.body.reason || '';
      order.refundStatus = req.body.paymentReceived ? 'Pending' : 'NotRequired';
      await order.save({ session });
      result = order;
    });

    await notifyUser(
      result.consumer,
      'OrderCancelled',
      `Order #${result._id.toString().slice(-6).toUpperCase()} was cancelled by the FPO. Reason: ${result.cancelReason || 'Not specified'}.`,
      { orderId: result._id }
    ).catch(() => {});

    res.json(result);
  } catch (e) {
    res.status(e.statusCode || 500).json({ message: e.message });
  } finally {
    await session.endSession();
  }
};

// Refund is a MONEY movement, not a stock movement — the stock was already
// restored when the order was cancelled/rejected. Left as a simple update,
// but still session-wrapped for consistency and to avoid a half-written
// refund state if a later step is added.
exports.processRefund = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const order = await FpoOrder.findOne({ _id: req.params.id, fpo: f });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (!['Cancelled', 'Rejected'].includes(order.status)) {
      return res.status(400).json({ message: 'Refund only available for cancelled/rejected orders.' });
    }
    if (order.refundStatus === 'Processed') {
      return res.status(400).json({ message: 'Refund already processed.' });
    }

    order.refundStatus = 'Processed';
    order.refundTransactionId = req.body.refundTransactionId || `REF-${Date.now()}`;
    order.status = 'Refunded';
    await order.save();

    await notifyUser(
      order.consumer,
      'RefundProcessed',
      `Refund of ₹${order.totalPrice} for order #${order._id.toString().slice(-6).toUpperCase()} has been processed. Transaction Ref: ${order.refundTransactionId}`,
      { orderId: order._id }
    );

    res.json({ message: 'Refund marked as processed.', order });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Consumer-initiated order cancellation (eligible when Placed or Accepted)
// Now delegates the stock restoration to the same unified service used by
// the FPO-side cancel/reject paths (Issue 5), wrapped in a transaction.
exports.consumerCancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const userId = req.user._id || req.user.id;
      const order = await FpoOrder.findOne({ _id: req.params.id, consumer: userId }).session(session);
      if (!order) {
        const err = new Error('Order not found.');
        err.statusCode = 404;
        throw err;
      }

      if (!['Placed', 'Accepted'].includes(order.status)) {
        const err = new Error(`Order cannot be cancelled at stage '${order.status}'. Please contact customer support.`);
        err.statusCode = 400;
        throw err;
      }

      await restoreOrderStock(
        order,
        { note: `Consumer cancelled order: ${req.body.reason || 'No reason provided'}` },
        session
      );

      order.status = 'Cancelled';
      order.cancelReason = req.body.reason || 'Cancelled by buyer';
      order.refundStatus = order.paymentMethod !== 'COD' ? 'Pending' : 'NotRequired';
      await order.save({ session });
      result = order;
    });

    await notify(
      result.fpo,
      'OrderCancelled',
      `Order #${result._id.toString().slice(-6)} was cancelled by buyer. Reason: ${result.cancelReason}`,
      { orderId: result._id }
    ).catch(() => {});

    res.json({ message: 'Order cancelled successfully.', order: result });
  } catch (e) {
    res.status(e.statusCode || 500).json({ message: e.message });
  } finally {
    await session.endSession();
  }
};

// Consumer-initiated return/refund request (eligible when Delivered)
exports.consumerRequestReturn = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await FpoOrder.findOne({ _id: req.params.id, consumer: userId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (order.status !== 'Delivered') {
      return res.status(400).json({ message: 'Return requests can only be made for delivered orders.' });
    }

    if (['Pending', 'Processed'].includes(order.refundStatus)) {
      return res.status(400).json({ message: 'A return/refund request is already pending or processed.' });
    }

    order.returnReason = req.body.reason || 'Produce return / refund requested';
    order.refundStatus = 'Pending';
    await order.save();

    await notify(
      order.fpo,
      'ReturnRequested',
      `Return request for Order #${order._id.toString().slice(-6)}. Reason: ${order.returnReason}`,
      { orderId: order._id }
    ).catch(() => {});

    res.json({ message: 'Return request submitted successfully.', order });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
