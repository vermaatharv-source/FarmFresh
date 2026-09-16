const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['Listing', 'Produce'],
      required: true,
      default: 'Listing',
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      index: true,
    },
    produce: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Produce',
      index: true,
    },
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'orderModel',
    },
    orderModel: {
      type: String,
      enum: ['FpoOrder', 'Order'],
      default: 'FpoOrder',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    freshnessRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    isVerifiedBuyer: {
      type: Boolean,
      default: false,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    voters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

reviewSchema.index({ listing: 1, consumer: 1 }, { sparse: true });
reviewSchema.index({ produce: 1, consumer: 1 }, { sparse: true });

module.exports = mongoose.model('Review', reviewSchema);
