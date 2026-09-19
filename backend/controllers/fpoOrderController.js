const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const FpoOrder = require('../models/FpoOrder');
const { notify, notifyUser } = require('../utils/notify');

const getFpoId = async (userId) => {
  const f = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return f ? f._id : null;
};

// Buyer places order (supports buyerType for bulk buyers)
exports.createOrder = async (req, res) => {
  try {
    const { listingId, quantityKg, buyerType = 'INDIVIDUAL' } = req.body;
    const qty = Number(quantityKg);

    const existingListing = await Listing.findOne({ _id: listingId, status: 'Published' });
    if (!existingListing) {
      return res.status(404).json({ message: 'Listing not found or not published.' });
    }

    if (!['INDIVIDUAL', 'RESTAURANT', 'KIRANA', 'WHOLESALER'].includes(buyerType)) {
      return res.status(400).json({ message: 'Invalid buyer type.' });
    }

    if (!(qty >= existingListing.minOrderQtyKg)) {
      return res.status(400).json({ message: `Minimum order quantity is ${existingListing.minOrderQtyKg}kg.` });
    }

    if (existingListing.availableQuantityKg < qty) {
      return res.status(400).json({ message: 'Not enough quantity available.' });
    }

    // Reduce available stock on listing — atomic check + decrement in one DB
    // operation, so concurrent orders can never oversell the listing.
    const listing = await Listing.findOneAndUpdate(
      { _id: listingId, status: 'Published', availableQuantityKg: { $gte: qty } },
      { $inc: { availableQuantityKg: -qty } },
      { new: true }
    );
    if (!listing) {
      return res.status(400).json({ message: 'Not enough quantity available.' });
    }

    // Update inventory
    const inv = await Inventory.findOne({
      fpo: listing.fpo,
      produceType: listing.produceType,
      grade: listing.grade,
    });
    if (inv) {
      inv.reservedQuantity = Math.max(0, inv.reservedQuantity - qty);
      inv.soldQuantity += qty;
      await inv.save();
    }

    const order = await FpoOrder.create({
      fpo: listing.fpo,
      listing: listing._id,
      consumer: req.user._id || req.user.id,
      quantityKg: qty,
      totalPrice: qty * listing.pricePerKg,
      buyerType,
      gradeOrdered: listing.grade,
      status: 'Placed',
    });

    await StockMovement.create({
      fpo: listing.fpo,
      produceType: listing.produceType,
      grade: listing.grade,
      type: 'Sold',
      quantityKg: qty,
      listing: listing._id,
      order: order._id,
    });

    await notify(
      listing.fpo,
      'NewOrder',
      `New ${buyerType} order: ${qty}kg ${listing.produceType} Grade ${listing.grade}.`,
      { orderId: order._id }
    );

    await notifyUser(
      req.user._id || req.user.id,
      'OrderAccepted',
      `Your order for ${qty}kg ${listing.produceType} (Grade ${listing.grade}) has been placed!`,
      { orderId: order._id }
    ).catch(() => {});

    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
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

exports.updateOrderStatus = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const order = await FpoOrder.findOne({ _id: req.params.id, fpo: f });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const { status, rejectionReason } = req.body;
    if (!transitions[order.status]?.includes(status)) {
      return res.status(400).json({ message: `Invalid transition ${order.status} → ${status}.` });
    }

    if (status === 'Rejected') {
      order.rejectionReason = rejectionReason || '';
    }

    order.status = status;
    await order.save();

    // Notify consumer about order lifecycle change
    const orderShortId = order._id.toString().slice(-6).toUpperCase();
    let consumerMsg = '';
    let notificationType = 'System';

    if (status === 'Accepted') {
      notificationType = 'OrderAccepted';
      consumerMsg = `Your order #${orderShortId} has been confirmed by the FPO warehouse!`;
    } else if (status === 'Packed') {
      notificationType = 'OrderPacked';
      consumerMsg = `Order #${orderShortId} has passed quality grading and is packed in cold chain.`;
    } else if (status === 'Dispatched') {
      notificationType = 'OrderDispatched';
      consumerMsg = `Order #${orderShortId} is out for delivery! Estimated slot: ${order.deliverySlot || 'Standard Delivery'}.`;
    } else if (status === 'Delivered') {
      notificationType = 'OrderDelivered';
      consumerMsg = `Order #${orderShortId} has been delivered safely! Please rate your produce freshness.`;
    } else if (status === 'Rejected') {
      notificationType = 'OrderCancelled';
      consumerMsg = `Order #${orderShortId} could not be fulfilled: ${order.rejectionReason || 'Produce unavailable'}.`;
    }

    if (consumerMsg) {
      await notifyUser(order.consumer, notificationType, consumerMsg, { orderId: order._id });
    }

    res.json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const order = await FpoOrder.findOne({ _id: req.params.id, fpo: f });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (['Delivered', 'Refunded', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({ message: 'Cannot cancel this order.' });
    }

    order.status = 'Cancelled';
    order.cancelReason = req.body.reason || '';
    order.refundStatus = req.body.paymentReceived ? 'Pending' : 'NotRequired';
    await order.save();
    res.json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

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
exports.consumerCancelOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await FpoOrder.findOne({ _id: req.params.id, consumer: userId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (!['Placed', 'Accepted'].includes(order.status)) {
      return res.status(400).json({ 
        message: `Order cannot be cancelled at stage '${order.status}'. Please contact customer support.` 
      });
    }

    // Restore stock to listing
    const listing = await Listing.findById(order.listing);
    if (listing) {
      listing.availableQuantityKg = (listing.availableQuantityKg || 0) + order.quantityKg;
      await listing.save();

      // Adjust inventory soldQuantity
      const inv = await Inventory.findOne({
        fpo: order.fpo,
        produceType: listing.produceType,
        grade: order.gradeOrdered || listing.grade,
      });
      if (inv) {
        inv.soldQuantity = Math.max(0, (inv.soldQuantity || 0) - order.quantityKg);
        await inv.save();
      }

      // Record stock movement
      await StockMovement.create({
        fpo: order.fpo,
        produceType: listing.produceType,
        grade: order.gradeOrdered || listing.grade,
        type: 'Adjustment',
        quantityKg: order.quantityKg,
        listing: listing._id,
        order: order._id,
        notes: `Consumer cancelled order: ${req.body.reason || 'No reason provided'}`
      });
    }

    order.status = 'Cancelled';
    order.cancelReason = req.body.reason || 'Cancelled by buyer';
    order.refundStatus = (order.paymentMethod !== 'COD') ? 'Pending' : 'NotRequired';
    await order.save();

    await notify(
      order.fpo,
      'OrderCancelled',
      `Order #${order._id.toString().slice(-6)} was cancelled by buyer. Reason: ${order.cancelReason}`,
      { orderId: order._id }
    ).catch(() => {});

    res.json({ message: 'Order cancelled successfully.', order });
  } catch (e) {
    res.status(500).json({ message: e.message });
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