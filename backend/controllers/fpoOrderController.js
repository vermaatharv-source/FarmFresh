const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const { notify } = require('../utils/notify');

const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

// 1. Consumer places an order against a Published listing.
exports.createOrder = async (req, res) => {
  try {
    if (req.user.role !== 'consumer') {
      return res.status(403).json({ message: 'Only consumers can place orders.' });
    }
    const { listingId, quantityKg } = req.body;
    const qty = Number(quantityKg);

    const listing = await Listing.findOne({ _id: listingId, status: 'Published' });
    if (!listing) return res.status(404).json({ message: 'Listing not found or not published.' });
    if (qty < listing.minOrderQtyKg) {
      return res.status(400).json({ message: `Minimum order quantity is ${listing.minOrderQtyKg}kg.` });
    }
    if (listing.availableQuantityKg < qty) {
      return res.status(400).json({ message: 'Not enough quantity available on this listing.' });
    }

    listing.availableQuantityKg -= qty;
    await listing.save();

    const inventory = await Inventory.findOne({ fpo: listing.fpo, produceType: listing.produceType, grade: listing.grade });
    if (inventory) {
      inventory.soldQuantity += qty;
      inventory.reservedQuantity = Math.max(0, inventory.reservedQuantity - qty);
      await inventory.save();
    }

    const order = await FpoOrder.create({
      fpo: listing.fpo,
      listing: listing._id,
      consumer: req.user._id || req.user.id,
      quantityKg: qty,
      totalPrice: qty * listing.pricePerKg,
      status: 'Placed',
    });

    await StockMovement.create({
      fpo: listing.fpo, produceType: listing.produceType, grade: listing.grade,
      type: 'Sold', quantityKg: qty, listing: listing._id, order: order._id,
    });

    await notify(listing.fpo, 'NewOrder', `New order placed for ${qty}kg of ${listing.produceType} (Grade ${listing.grade}).`, { orderId: order._id });

    res.status(201).json({ message: 'Order placed', order });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 2. FPO: view all orders against its listings
exports.getFpoOrders = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const orders = await FpoOrder.find({ fpo: fpoId })
      .populate('listing', 'produceType grade pricePerKg')
      .populate('consumer', 'name location')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 3. Consumer: view their own orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await FpoOrder.find({ consumer: req.user._id || req.user.id })
      .populate('listing', 'produceType grade pricePerKg images')
      .populate('fpo', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 4. FPO: advance order status (Placed -> Packed -> Dispatched -> Delivered)
exports.updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { status } = req.body;
    if (!['Packed', 'Dispatched', 'Delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition.' });
    }

    const order = await FpoOrder.findOne({ _id: req.params.id, fpo: fpoId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.status === 'Cancelled' || order.status === 'Delivered') {
      return res.status(400).json({ message: `Order is already ${order.status.toLowerCase()}, cannot update further.` });
    }

    order.status = status;
    await order.save();
    res.json({ message: `Order marked as ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 5. FPO: cancel an order — releases the quantity back to the listing + inventory
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { reason } = req.body;
    const order = await FpoOrder.findOne({ _id: req.params.id, fpo: fpoId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Cannot cancel a delivered order.' });
    }
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled.' });
    }

    const listing = await Listing.findById(order.listing);
    if (listing) {
      listing.availableQuantityKg += order.quantityKg;
      await listing.save();
    }
    const inventory = listing
      ? await Inventory.findOne({ fpo: fpoId, produceType: listing.produceType, grade: listing.grade })
      : null;
    if (inventory) {
      inventory.soldQuantity = Math.max(0, inventory.soldQuantity - order.quantityKg);
      inventory.reservedQuantity += order.quantityKg;
      await inventory.save();
      await StockMovement.create({
        fpo: fpoId, produceType: listing.produceType, grade: listing.grade,
        type: 'Cancelled', quantityKg: order.quantityKg, order: order._id,
        note: reason || 'Order cancelled',
      });
    }

    order.status = 'Cancelled';
    order.cancelReason = reason || '';
    await order.save();

    res.json({ message: 'Order cancelled and stock released.', order });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
