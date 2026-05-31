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
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
    checkoutUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ orderCode: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
