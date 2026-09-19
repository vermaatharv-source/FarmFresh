const express = require('express');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const Inventory = require('../models/Inventory');
const { protect } = require('../middleware/authMiddleware');
const { notifyUser } = require('../utils/notify');

const router = express.Router();

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

// Unified multi-item checkout endpoint (FPO listings only)
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

    let subtotal = 0;
    const validatedItems = [];

    // 1. Validation pass
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        return res.status(400).json({ message: `Invalid quantity for ${item.name || 'item'}.` });
      }

      // Only FPO listings are sold. Stale carts may still hold old farmer-direct items.
      if (item.type !== 'FPO') {
        return res.status(400).json({
          message: `${item.name || 'An item'} is no longer available. Please remove it from your cart.`
        });
      }

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
      validatedItems.push({ listing, qty, itemTotal, buyerType: item.buyerType || 'INDIVIDUAL' });
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

      // Atomic operation: the stock check and the decrement happen as one DB
      // operation, so two concurrent checkouts can never oversell a listing.
      const updatedListing = await Listing.findOneAndUpdate(
        { _id: v.listing._id, status: 'Published', availableQuantityKg: { $gte: v.qty } },
        { $inc: { availableQuantityKg: -v.qty } },
        { new: true }
      );

      if (!updatedListing) {
        return res.status(400).json({ message: `Failed to secure stock for ${v.listing.produceType}.` });
      }

      const inv = await Inventory.findOne({
        fpo: updatedListing.fpo,
        produceType: updatedListing.produceType,
        grade: updatedListing.grade,
      });
      if (inv) {
        inv.reservedQuantity = Math.max(0, inv.reservedQuantity - v.qty);
        inv.soldQuantity += v.qty;
        await inv.save();
      }

      const fOrder = await FpoOrder.create({
        fpo: updatedListing.fpo,
        listing: updatedListing._id,
        consumer: req.user._id || req.user.id,
        quantityKg: v.qty,
        totalPrice: finalPrice,
        buyerType: v.buyerType,
        gradeOrdered: updatedListing.grade,
        status: 'Placed',
        deliveryAddress,
        deliverySlot,
        paymentMethod,
        discountAmount: itemDiscount,
        couponCode: code
      });
      createdOrders.push({ orderType: 'FPO', id: fOrder._id, name: updatedListing.produceType, quantity: v.qty, total: finalPrice });
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

module.exports = router;