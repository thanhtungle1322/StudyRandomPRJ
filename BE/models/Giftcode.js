const mongoose = require('mongoose');

const giftcodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    planId: {
      type: String,
      enum: ['starter', 'pro', 'ultimate'],
      default: 'starter',
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Giftcode = mongoose.model('Giftcode', giftcodeSchema);

module.exports = Giftcode;
