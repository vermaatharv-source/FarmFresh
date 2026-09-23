const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const FpoOrder = require('../models/FpoOrder');
const { protect } = require('../middleware/authMiddleware');
const { voteLimiter } = require('../middleware/rateLimiters');

// Submit or update a review
router.post('/', protect, async (req, res) => {
  try {
    const {
      targetType = 'Listing',
      targetId,
      rating,
      freshnessRating = 5,
      deliveryRating = 5,
      title = '',
      comment = '',
    } = req.body;

    if (!targetId) {
      return res.status(400).json({ message: 'Target product ID is required.' });
    }

    if (targetType !== 'Listing') {
      return res.status(400).json({ message: 'Only FPO listings can be reviewed.' });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });
    }

    const userId = req.user._id || req.user.id;

    // Check if consumer is a verified buyer
    let isVerifiedBuyer = false;
    let verifiedOrderId = null;

    const deliveredOrder = await FpoOrder.findOne({
      consumer: userId,
      listing: targetId,
      status: 'Delivered',
    });
    if (deliveredOrder) {
      isVerifiedBuyer = true;
      verifiedOrderId = deliveredOrder._id;
    }

    const filter = {
      targetType: 'Listing',
      consumer: userId,
      listing: targetId,
    };

    const updateData = {
      rating: numRating,
      freshnessRating: Math.max(1, Math.min(5, Number(freshnessRating) || 5)),
      deliveryRating: Math.max(1, Math.min(5, Number(deliveryRating) || 5)),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedBuyer,
      ...(verifiedOrderId ? { order: verifiedOrderId } : {}),
    };

    const review = await Review.findOneAndUpdate(
      filter,
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('consumer', 'name location');

    res.status(201).json({
      message: 'Review saved successfully!',
      review,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get reviews and aggregated metrics for a product
router.get('/item/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (targetType !== 'Listing') {
      return res.status(400).json({ message: 'Only FPO listings can be reviewed.' });
    }
    const filter = { targetType: 'Listing', listing: targetId };

    const reviews = await Review.find(filter)
      .populate('consumer', 'name location')
      .sort({ createdAt: -1 });

    const totalReviews = reviews.length;
    let avgRating = 0;
    let avgFreshness = 0;
    let avgDelivery = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    if (totalReviews > 0) {
      let sumRating = 0;
      let sumFreshness = 0;
      let sumDelivery = 0;

      reviews.forEach((r) => {
        sumRating += r.rating;
        sumFreshness += r.freshnessRating || 5;
        sumDelivery += r.deliveryRating || 5;
        const rounded = Math.round(r.rating);
        if (distribution[rounded] !== undefined) {
          distribution[rounded]++;
        }
      });

      avgRating = Number((sumRating / totalReviews).toFixed(1));
      avgFreshness = Number((sumFreshness / totalReviews).toFixed(1));
      avgDelivery = Number((sumDelivery / totalReviews).toFixed(1));
    }

    res.json({
      reviews,
      stats: {
        totalReviews,
        averageRating: avgRating,
        averageFreshness: avgFreshness,
        averageDelivery: avgDelivery,
        distribution,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle helpful vote on a review
router.post('/:id/vote', protect, voteLimiter, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    const userId = req.user._id || req.user.id;
    const hasVoted = review.voters.some((v) => v.toString() === userId.toString());

    if (hasVoted) {
      review.voters = review.voters.filter((v) => v.toString() !== userId.toString());
      review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
    } else {
      review.voters.push(userId);
      review.helpfulVotes += 1;
    }

    await review.save();

    res.json({
      helpfulVotes: review.helpfulVotes,
      hasVoted: !hasVoted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check if current user has reviewed this item & whether they are verified
router.get('/my-review/:targetType/:targetId', protect, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (targetType !== 'Listing') {
      return res.status(400).json({ message: 'Only FPO listings can be reviewed.' });
    }
    const userId = req.user._id || req.user.id;

    const review = await Review.findOne({
      targetType: 'Listing',
      consumer: userId,
      listing: targetId,
    });

    const deliveredOrder = await FpoOrder.findOne({
      consumer: userId,
      listing: targetId,
      status: 'Delivered',
    });
    const isVerifiedBuyer = Boolean(deliveredOrder);

    res.json({
      review,
      isVerifiedBuyer,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's own reviews
router.get('/mine', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const reviews = await Review.find({ consumer: userId, targetType: 'Listing' })
      .populate('listing', 'produceType grade images')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;