const express = require('express');
const Order = require('../models/Order');
const Produce = require('../models/Produce');
const { protect } = require('../middleware/authMiddleware');
const { notifyUser } = require('../utils/notify');

const router = express.Router();

// Place a single direct produce order (consumer only) — atomic stock decrement
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'consumer') {
      return res.status(403).json({ message: 'Only consumers can place orders' });
    }

    const { 
      produceId, 
      quantity, 
      deliveryAddress, 
      deliverySlot = 'Standard Delivery', 
      paymentMethod = 'CARD', 
      discountAmount = 0, 
      couponCode = '' 
    } = req.body;

    // Atomic operation: only decrements if enough stock exists.
    const produce = await Produce.findOneAndUpdate(
      { _id: produceId, quantityAvailable: { $gte: quantity } },
      { $inc: { quantityAvailable: -quantity } },
      { new: true }
    );

    if (!produce) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    const rawTotal = produce.pricePerKg * quantity;
    const totalPrice = Math.max(0, rawTotal - Number(discountAmount || 0));

    const order = await Order.create({
      consumerId: req.user._id || req.user.id,
      produceId: produce._id,
      farmerId: produce.farmerId,
      quantity,
      totalPrice,
      status: 'placed',
      deliveryAddress,
      deliverySlot,
      paymentMethod,
      discountAmount: Number(discountAmount || 0),
      couponCode: couponCode || ''
    });

    const shortId = order._id.toString().slice(-6).toUpperCase();
    await notifyUser(
      req.user._id || req.user.id,
      'OrderAccepted',
      `Order #${shortId} placed successfully! Harvest is being prepared.`,
      { orderId: order._id }
    ).catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Validate coupon endpoint
router.post('/validate-coupon', protect, (req, res) => {
  const { couponCode, subtotal = 0 } = req.body;
  const code = String(couponCode || '').trim().toUpperCase();

  const coupons = {
    'FRESH10': { type: 'PERCENT', value: 10, maxDiscount: 150, minOrder: 100, desc: '10% off up to ₹150' },
    'WELCOME50': { type: 'FLAT', value: 50, minOrder: 200, desc: 'Flat ₹50 off on orders ₹200+' },
    'KISANFEST': { type: 'PERCENT', value: 15, maxDiscount: 200, minOrder: 300, desc: '15% off up to ₹200 on fresh harvest' }
  };

  const coupon = coupons[code];
  if (!coupon) {
    return res.status(400).json({ message: 'Invalid or expired coupon code.' });
  }

  if (subtotal < coupon.minOrder) {
    return res.status(400).json({ message: `Coupon requires a minimum order of ₹${coupon.minOrder}.` });
  }

  let discount = 0;
  if (coupon.type === 'PERCENT') {
    discount = Math.min(coupon.maxDiscount, Math.round((subtotal * coupon.value) / 100));
  } else if (coupon.type === 'FLAT') {
    discount = Math.min(subtotal, coupon.value);
  }

  res.json({
    valid: true,
    code,
    discount,
    description: coupon.desc
  });
});

// Unified multi-item checkout endpoint
router.post('/checkout', protect, async (req, res) => {
  try {
    const { 
      items = [], 
      deliveryAddress, 
      deliverySlot = 'Standard Delivery', 
      paymentMethod = 'CARD', 
      couponCode = '' 
    } = req.body;

    if (!items.length) {
      return res.status(400).json({ message: 'Cart is empty.' });
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.streetAddress) {
      return res.status(400).json({ message: 'Please select or provide a complete delivery address.' });
    }

    const Listing = require('../models/Listing');
    const FpoOrder = require('../models/FpoOrder');
    const Inventory = require('../models/Inventory');

    let subtotal = 0;
    const validatedItems = [];

    // 1. Validation pass
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({ message: `Invalid quantity for ${item.name || 'item'}.` });
      }

      if (item.type === 'FPO') {
        const listing = await Listing.findOne({ _id: item.id, status: 'Published' });
        if (!listing) {
          return res.status(400).json({ message: `Listing ${item.name || ''} is no longer available.` });
        }
        if (qty < listing.minOrderQtyKg) {
          return res.status(400).json({ message: `Minimum order for ${listing.produceType} is ${listing.minOrderQtyKg}kg.` });
        }
        if (listing.availableQuantityKg < qty) {
          return res.status(400).json({ message: `Not enough stock for ${listing.produceType}. Only ${listing.availableQuantityKg}kg available.` });
        }
        const itemTotal = listing.pricePerKg * qty;
        subtotal += itemTotal;
        validatedItems.push({ type: 'FPO', listing, qty, itemTotal, buyerType: item.buyerType || 'INDIVIDUAL' });
      } else {
        const produce = await Produce.findById(item.id);
        if (!produce) {
          return res.status(400).json({ message: `Produce ${item.name || ''} is no longer available.` });
        }
        if (produce.quantityAvailable < qty) {
          return res.status(400).json({ message: `Not enough stock for ${produce.name}. Only ${produce.quantityAvailable}kg available.` });
        }
        const itemTotal = produce.pricePerKg * qty;
        subtotal += itemTotal;
        validatedItems.push({ type: 'DIRECT', produce, qty, itemTotal });
      }
    }

    // 2. Coupon calculation
    let totalDiscount = 0;
    const code = String(couponCode || '').trim().toUpperCase();
    if (code === 'FRESH10' && subtotal >= 100) {
      totalDiscount = Math.min(150, Math.round(subtotal * 0.1));
    } else if (code === 'WELCOME50' && subtotal >= 200) {
      totalDiscount = Math.min(subtotal, 50);
    } else if (code === 'KISANFEST' && subtotal >= 300) {
      totalDiscount = Math.min(200, Math.round(subtotal * 0.15));
    }

    const createdOrders = [];
    const discountRatio = subtotal > 0 ? (totalDiscount / subtotal) : 0;

    // 3. Execution pass
    for (const v of validatedItems) {
      const itemDiscount = Math.round(v.itemTotal * discountRatio);
      const finalPrice = Math.max(0, v.itemTotal - itemDiscount);

      if (v.type === 'FPO') {
        v.listing.availableQuantityKg -= v.qty;
        await v.listing.save();

        const inv = await Inventory.findOne({
          fpo: v.listing.fpo,
          produceType: v.listing.produceType,
          grade: v.listing.grade,
        });
        if (inv) {
          inv.reservedQuantity = Math.max(0, inv.reservedQuantity - v.qty);
          inv.soldQuantity += v.qty;
          await inv.save();
        }

        const fOrder = await FpoOrder.create({
          fpo: v.listing.fpo,
          listing: v.listing._id,
          consumer: req.user._id || req.user.id,
          quantityKg: v.qty,
          totalPrice: finalPrice,
          buyerType: v.buyerType,
          gradeOrdered: v.listing.grade,
          status: 'Placed',
          deliveryAddress,
          deliverySlot,
          paymentMethod,
          discountAmount: itemDiscount,
          couponCode: code
        });
        createdOrders.push({ orderType: 'FPO', id: fOrder._id, name: v.listing.produceType, quantity: v.qty, total: finalPrice });
      } else {
        const updatedProduce = await Produce.findOneAndUpdate(
          { _id: v.produce._id, quantityAvailable: { $gte: v.qty } },
          { $inc: { quantityAvailable: -v.qty } },
          { new: true }
        );

        if (!updatedProduce) {
          return res.status(400).json({ message: `Failed to secure stock for ${v.produce.name}.` });
        }

        const dOrder = await Order.create({
          consumerId: req.user._id || req.user.id,
          produceId: updatedProduce._id,
          farmerId: updatedProduce.farmerId,
          quantity: v.qty,
          totalPrice: finalPrice,
          status: 'placed',
          deliveryAddress,
          deliverySlot,
          paymentMethod,
          discountAmount: itemDiscount,
          couponCode: code
        });
        createdOrders.push({ orderType: 'DIRECT', id: dOrder._id, name: updatedProduce.name, quantity: v.qty, total: finalPrice });
      }
    }

    if (createdOrders.length > 0) {
      await notifyUser(
        req.user._id || req.user.id,
        'OrderAccepted',
        `Checkout complete! ${createdOrders.length} item(s) ordered and routed for packing.`,
        { orderId: createdOrders[0].id }
      ).catch(() => {});
    }

    res.status(201).json({
      message: 'Checkout completed successfully!',
      orderSummary: {
        itemCount: validatedItems.length,
        subtotal,
        discount: totalDiscount,
        total: subtotal - totalDiscount,
        deliverySlot,
        deliveryAddress,
        paymentMethod,
        orders: createdOrders,
        placedAt: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Consumer's own orders
router.get('/mine', protect, async (req, res) => {
  try {
    const orders = await Order.find({ consumerId: req.user.id })
      .populate('produceId', 'name category imageUrl')
      .populate('farmerId', 'name location');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Farmer's received orders
router.get('/received', protect, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can view received orders' });
    }
    const orders = await Order.find({ farmerId: req.user.id })
      .populate('produceId', 'name category imageUrl')
      .populate('consumerId', 'name location');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update order status (farmer only)
router.put('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can update order status' });
    }

    const { status } = req.body;
    if (!['placed', 'confirmed', 'delivered'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, farmerId: req.user.id },
      { status },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const shortId = order._id.toString().slice(-6).toUpperCase();
    if (status === 'confirmed') {
      await notifyUser(
        order.consumerId,
        'OrderAccepted',
        `Farmer confirmed your order #${shortId}! Harvest is prepared for dispatch.`,
        { orderId: order._id }
      );
    } else if (status === 'delivered') {
      await notifyUser(
        order.consumerId,
        'OrderDelivered',
        `Your order #${shortId} has been marked as delivered by the farmer!`,
        { orderId: order._id }
      );
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel direct order (consumer only)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, consumerId: req.user.id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = (order.status || '').toLowerCase();
    if (!['placed', 'confirmed'].includes(currentStatus)) {
      return res.status(400).json({ message: `Cannot cancel order at stage: ${order.status}` });
    }

    // Restore produce quantity
    await Produce.findByIdAndUpdate(order.produceId, {
      $inc: { quantityAvailable: order.quantity }
    });

    order.status = 'cancelled';
    order.cancelReason = req.body.reason || 'Cancelled by consumer';
    order.refundStatus = (order.paymentMethod !== 'COD') ? 'Pending' : 'NotRequired';
    await order.save();

    res.json({ message: 'Order cancelled successfully', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Request return / refund (consumer only)
router.post('/:id/return', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, consumerId: req.user.id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = (order.status || '').toLowerCase();
    if (currentStatus !== 'delivered') {
      return res.status(400).json({ message: 'Return requests can only be made for delivered orders' });
    }

    if (order.refundStatus === 'Pending' || order.refundStatus === 'Processed') {
      return res.status(400).json({ message: 'A return or refund request is already pending or processed' });
    }

    order.returnReason = req.body.reason || 'Produce return / refund requested';
    order.refundStatus = 'Pending';
    await order.save();

    res.json({ message: 'Return request submitted successfully', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;