const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const FpoOrder = require('../models/FpoOrder');
const { notify } = require('../utils/notify');

const getFpoId = async (userId) => {
  const f = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return f ? f._id : null;
};

// Buyer places order (supports buyerType for bulk buyers)
exports.createOrder = async (req, res) => {
  try {
    const { listingId, quantityKg, buyerType = 'INDIVIDUAL' } = req.body;
    const qty = Number(quantityKg);

    const listing = await Listing.findOne({ _id: listingId, status: 'Published' });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or not published.' });
    }

    if (!['INDIVIDUAL', 'RESTAURANT', 'KIRANA', 'WHOLESALER'].includes(buyerType)) {
      return res.status(400).json({ message: 'Invalid buyer type.' });
    }

    if (!(qty >= listing.minOrderQtyKg)) {
      return res.status(400).json({ message: `Minimum order quantity is ${listing.minOrderQtyKg}kg.` });
    }

    if (listing.availableQuantityKg < qty) {
      return res.status(400).json({ message: 'Not enough quantity available.' });
    }

    // Reduce available stock on listing
    listing.availableQuantityKg -= qty;
    await listing.save();

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

    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Buyer's own FPO orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await FpoOrder.find({ consumer: req.user._id || req.user.id })
      .populate('listing', 'produceType grade pricePerKg images')
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
    res.json({ message: 'Refund marked as processed.', order });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};