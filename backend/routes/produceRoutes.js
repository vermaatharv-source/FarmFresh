const express = require('express');
const Produce = require('../models/Produce');
const Order = require('../models/Order');
const { protect, farmerOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

// Create produce listing (farmer only)
router.post('/', protect, farmerOnly, upload.single('image'), async (req, res) => {
  try {
    const { name, category, pricePerKg, quantityAvailable, location } = req.body;

    const produce = await Produce.create({
      farmerId: req.user.id,
      name,
      category,
      pricePerKg,
      quantityAvailable,
      location,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : ''
    });

    res.status(201).json(produce);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Browse all produce (public, with optional filters + trending signal)
router.get('/', async (req, res) => {
  try {
    const { category, location } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (location) filter.location = { $regex: location, $options: 'i' };

    const produce = await Produce.find(filter).populate('farmerId', 'name location');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingCounts = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$produceId', orderCount: { $sum: 1 } } }
    ]);

    const trendingMap = {};
    trendingCounts.forEach((t) => {
      trendingMap[t._id.toString()] = t.orderCount;
    });

    const produceWithTrending = produce.map((item) => {
      const obj = item.toObject();
      obj.orderCount = trendingMap[item._id.toString()] || 0;
      obj.isTrending = obj.orderCount >= 3;
      return obj;
    });

    res.json(produceWithTrending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get logged-in farmer's own listings
router.get('/mine', protect, farmerOnly, async (req, res) => {
  try {
    const produce = await Produce.find({ farmerId: req.user.id });
    res.json(produce);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a listing (farmer only, own listing)
router.put('/:id', protect, farmerOnly, async (req, res) => {
  try {
    const produce = await Produce.findOne({ _id: req.params.id, farmerId: req.user.id });
    if (!produce) return res.status(404).json({ message: 'Listing not found' });

    Object.assign(produce, req.body);
    await produce.save();
    res.json(produce);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a listing (farmer only, own listing) — blocked if active orders exist
router.delete('/:id', protect, farmerOnly, async (req, res) => {
  try {
    const activeOrders = await Order.countDocuments({
      produceId: req.params.id,
      status: { $ne: 'delivered' }
    });

    if (activeOrders > 0) {
      return res.status(400).json({ message: 'Cannot delete: this listing has active orders' });
    }

    const produce = await Produce.findOneAndDelete({ _id: req.params.id, farmerId: req.user.id });
    if (!produce) return res.status(404).json({ message: 'Listing not found' });
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;