const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Listing = require('../models/Listing');
const Produce = require('../models/Produce');
const { protect } = require('../middleware/authMiddleware');
const { notifyUser } = require('../utils/notify');

const dayToNumber = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const getNextDayOfWeek = (dayName) => {
  const targetDay = dayToNumber[dayName] !== undefined ? dayToNumber[dayName] : 1;
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;

  // If today or past today in the week, schedule next week's occurrence
  if (daysUntil <= 1) {
    daysUntil += 7;
  }

  const nextDate = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);
  nextDate.setHours(8, 0, 0, 0);
  return nextDate;
};

const advanceDateByFrequency = (date, frequency) => {
  const base = new Date(date);
  let days = 7;
  if (frequency === 'BiWeekly') days = 14;
  if (frequency === 'Monthly') days = 28;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
};

// Create a new subscription
router.post('/', protect, async (req, res) => {
  try {
    const {
      itemType = 'FPO',
      listingId,
      produceId,
      quantityKg,
      frequency = 'Weekly',
      deliveryDay = 'Monday',
      deliverySlot = 'Morning (6:00 AM - 9:00 AM)',
      deliveryAddress,
      paymentMethod = 'CARD',
      notes = '',
    } = req.body;

    const qty = Number(quantityKg);
    if (!qty || qty < 0.5) {
      return res.status(400).json({ message: 'Quantity must be at least 0.5 kg.' });
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.streetAddress || !deliveryAddress.phone) {
      return res.status(400).json({ message: 'A complete delivery address is required for subscriptions.' });
    }

    let produceName = 'Farm Fresh Produce';
    let unitPrice = 0;
    let grade = 'A';
    let targetListing = null;
    let targetProduce = null;

    if (itemType === 'FPO') {
      targetListing = await Listing.findById(listingId);
      if (!targetListing) {
        return res.status(404).json({ message: 'FPO listing not found or unavailable.' });
      }
      produceName = targetListing.produceType;
      unitPrice = targetListing.pricePerKg;
      grade = targetListing.grade || 'A';
    } else {
      targetProduce = await Produce.findById(produceId);
      if (!targetProduce) {
        return res.status(404).json({ message: 'Direct produce not found or unavailable.' });
      }
      produceName = targetProduce.name;
      unitPrice = targetProduce.pricePerKg;
      grade = targetProduce.category || 'Direct';
    }

    const basePrice = Math.round(unitPrice * qty);
    const discountPercent = 5; // 5% Subscribe & Save discount
    const finalPricePerDelivery = Math.round(basePrice * ((100 - discountPercent) / 100));
    const nextDeliveryDate = getNextDayOfWeek(deliveryDay);

    const subscription = await Subscription.create({
      consumer: req.user._id || req.user.id,
      itemType,
      listing: targetListing ? targetListing._id : undefined,
      produce: targetProduce ? targetProduce._id : undefined,
      produceName,
      grade,
      quantityKg: qty,
      frequency,
      deliveryDay,
      deliverySlot,
      deliveryAddress,
      paymentMethod,
      basePrice,
      discountPercent,
      finalPricePerDelivery,
      status: 'Active',
      nextDeliveryDate,
      notes,
    });

    const dateStr = nextDeliveryDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    await notifyUser(
      req.user._id || req.user.id,
      'System',
      `Subscribed to ${qty}kg of fresh ${produceName}! First delivery scheduled on ${dateStr}.`,
      { subscriptionId: subscription._id }
    );

    res.status(201).json({
      message: 'Subscription created successfully!',
      subscription,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's own subscriptions
router.get('/mine', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const subscriptions = await Subscription.find({ consumer: userId })
      .populate('listing', 'images availableQuantityKg status')
      .populate('produce', 'imageUrl quantityAvailable')
      .sort({ status: 1, createdAt: -1 });

    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update subscription status (Pause / Resume / Cancel)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Paused', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid subscription status.' });
    }

    const userId = req.user._id || req.user.id;
    const subscription = await Subscription.findOne({ _id: req.params.id, consumer: userId });
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found.' });
    }

    subscription.status = status;
    await subscription.save();

    let notifyText = `Subscription for ${subscription.produceName} is now ${status}.`;
    if (status === 'Paused') {
      notifyText = `Subscription for ${subscription.produceName} has been paused. You will not be charged until resumed.`;
    } else if (status === 'Cancelled') {
      notifyText = `Subscription for ${subscription.produceName} has been cancelled.`;
    }

    await notifyUser(userId, 'System', notifyText, { subscriptionId: subscription._id });

    res.json({ message: `Subscription updated to ${status}`, subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Skip next scheduled delivery
router.patch('/:id/skip', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const subscription = await Subscription.findOne({ _id: req.params.id, consumer: userId });
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found.' });
    }

    const previousDate = new Date(subscription.nextDeliveryDate);
    const newDate = advanceDateByFrequency(previousDate, subscription.frequency);
    subscription.nextDeliveryDate = newDate;
    await subscription.save();

    const newDateStr = newDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    await notifyUser(
      userId,
      'System',
      `Skipped upcoming delivery for ${subscription.produceName}. Next delivery rescheduled for ${newDateStr}.`,
      { subscriptionId: subscription._id }
    );

    res.json({
      message: `Upcoming delivery skipped! Next delivery scheduled for ${newDateStr}.`,
      subscription,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
