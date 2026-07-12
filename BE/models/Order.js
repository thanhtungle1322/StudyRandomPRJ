const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: Number,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    activePurchaseKey: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending',
    },
    checkoutUrl: {
      type: String,
    },
    checkoutCreatingAt: {
      type: Date,
    },
    processingAt: {
      type: Date,
    },
    fulfilledAt: {
      type: Date,
    },
    fulfillmentResult: {
      type: String,
      enum: ['granted', 'superseded'],
    },
    fulfillmentError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ activePurchaseKey: 1 }, { unique: true, sparse: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
