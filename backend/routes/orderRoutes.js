const express = require('express');
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const { InventoryError, assertListingAvailable, applyOrderStock } = require('../services/inventoryService');
const { protect } = require('../middleware/authMiddleware');
const { notifyUser } = require('../utils/notify');
const { recordOrderPayment } = require('../services/paymentService');
const { calculateSplit, round2 } = require('../config/platformFee');

const router = express.Router();

// Public checkout configuration. The percentage comes from the backend ENV,
// so changing PLATFORM_FEE_PERCENT in one place updates the whole checkout UI.
router.get('/platform-fee', (req, res) => {
  const { percent } = calculateSplit(0);
  res.json({ percent });
});

// Validate coupon endpoint
router.post('/validate-coupon', protect, (req, res) => {
  const { couponCode, subtotal = 0 } = req.body;
  const code = String(couponCode || '').trim().toUpperCase();

  const coupons = {
    FRESH10: { type: 'PERCENT', value: 10, maxDiscount: 150, minOrder: 100, desc: '10% off up to ₹150' },
    WELCOME50: { type: 'FLAT', value: 50, minOrder: 200, desc: 'Flat ₹50 off on orders ₹200+' },
    KISANFEST: { type: 'PERCENT', value: 15, maxDiscount: 200, minOrder: 300, desc: '15% off up to ₹200 on fresh harvest' },
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
    description: coupon.desc,
  });
});

// Unified multi-item checkout endpoint (FPO listings only)
//
// Fix (Issue 2): the validate -> decrement -> update-inventory -> create-order
// sequence now runs inside a single MongoDB session/transaction
// (session.withTransaction). If any item in the cart fails at any step —
// a listing going out of stock, an order failing to save, etc — every
// change made so far in this checkout (stock already decremented for
// earlier items in the same cart, orders already created) is rolled back
// automatically. Previously a failure partway through left already-decremented
// listings with no order to show for it.
router.post('/checkout', protect, async (req, res) => {
  const {
    items = [],
    deliveryAddress,
    deliverySlot = 'Standard Delivery',
    paymentMethod = 'CARD',
    couponCode = '',
  } = req.body;

  if (!items.length) {
    return res.status(400).json({ message: 'Cart is empty.' });
  }

  if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.streetAddress) {
    return res.status(400).json({ message: 'Please select or provide a complete delivery address.' });
  }

  const session = await mongoose.startSession();
  let orderSummary;

  try {
    await session.withTransaction(async () => {
      let subtotal = 0;
      const validatedItems = [];

      // 1. Validation pass — read inside the transaction so the checks are
      // against a consistent snapshot.
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!qty || qty <= 0) {
          const err = new Error(`Invalid quantity for ${item.name || 'item'}.`);
          err.statusCode = 400;
          throw err;
        }

        // Only FPO listings are sold. Stale carts may still hold old farmer-direct items.
        if (item.type !== 'FPO') {
          const err = new Error(`${item.name || 'An item'} is no longer available. Please remove it from your cart.`);
          err.statusCode = 400;
          throw err;
        }

        const listing = await Listing.findOne({ _id: item.id, status: 'Published' }).session(session);
        assertListingAvailable(listing, qty);

        const itemTotal = round2(listing.pricePerKg * qty);
        subtotal = round2(subtotal + itemTotal);
        validatedItems.push({ listing, qty, itemTotal, buyerType: item.buyerType || 'INDIVIDUAL' });
      }

      // 2. No checkout discounts/coupons. Platform fee is the only checkout
      // adjustment and is calculated centrally by paymentService.js.

      const createdOrders = [];

      // 3. Execution pass — every write in this loop is part of the same
      // transaction, via the unified inventory service.
      for (const v of validatedItems) {
        const itemDiscount = 0;
        const finalPrice = Math.round(v.itemTotal * 100) / 100;

        const created = await FpoOrder.create(
          [
            {
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
              couponCode: '',
            },
          ],
          { session }
        );
        const fOrder = created[0];

        // Split payment: order amount -> FPO, platform fee -> platform. Auto-generates the transaction ID.
        const payment = await recordOrderPayment({ order: fOrder, session });

        const updatedListing = await applyOrderStock({
          listing: v.listing,
          qty: v.qty,
          orderId: fOrder._id,
          session,
        });

        createdOrders.push({
          orderType: 'FPO',
          id: fOrder._id,
          name: updatedListing.produceType,
          quantity: v.qty,
          total: finalPrice,
          platformFee: fOrder.platformFee,
          totalCharged: fOrder.totalCharged,
          transactionId: payment.transactionId,
        });
      }

      orderSummary = {
        itemCount: validatedItems.length,
        subtotal,
        discount: 0,
        total: round2(subtotal),
        platformFee: round2(createdOrders.reduce((s, o) => s + (Number(o.platformFee) || 0), 0)),
        platformFeePercent: calculateSplit(0).percent,
        totalCharged: round2(createdOrders.reduce((s, o) => s + (Number(o.totalCharged) || 0), 0)),
        transactionIds: createdOrders.map((o) => o.transactionId),
        deliverySlot,
        deliveryAddress,
        paymentMethod,
        orders: createdOrders,
        placedAt: new Date(),
      };
    });
  } catch (err) {
    const status = err instanceof InventoryError || err.statusCode ? err.statusCode || 400 : 500;
    return res.status(status).json({ message: err.message });
  } finally {
    await session.endSession();
  }

  if (orderSummary.orders.length > 0) {
    await notifyUser(
      req.user._id || req.user.id,
      'OrderAccepted',
      `Checkout complete! ${orderSummary.orders.length} item(s) ordered and routed for packing.`,
      { orderId: orderSummary.orders[0].id }
    ).catch(() => {});
  }

  res.status(201).json({
    message: 'Checkout completed successfully!',
    orderSummary,
  });
});

module.exports = router;