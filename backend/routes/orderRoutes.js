const express = require('express');
const Order = require('../models/Order');
const Produce = require('../models/Produce');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Place an order (consumer only) — atomic stock decrement
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'consumer') {
      return res.status(403).json({ message: 'Only consumers can place orders' });
    }

    const { produceId, quantity } = req.body;

    // Atomic operation: only decrements if enough stock exists.
    // Prevents two consumers from over-ordering the same stock simultaneously.
    const produce = await Produce.findOneAndUpdate(
      { _id: produceId, quantityAvailable: { $gte: quantity } },
      { $inc: { quantityAvailable: -quantity } },
      { new: true }
    );

    if (!produce) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    const totalPrice = produce.pricePerKg * quantity;

    const order = await Order.create({
      consumerId: req.user.id,
      produceId: produce._id,
      farmerId: produce.farmerId,
      quantity,
      totalPrice,
      status: 'placed'
    });

    res.status(201).json(order);
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
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;