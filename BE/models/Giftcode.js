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
    // ---- Usage Limit System ----
    maxUses: {
      type: Number,
      default: 1, // Default: single use. Set 0 for unlimited.
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    // Legacy boolean kept for backward compatibility (computed from usedCount/maxUses)
    isUsed: {
      type: Boolean,
      default: false,
    },
    // Track all users who used this code
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    usedByList: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

const Giftcode = mongoose.model('Giftcode', giftcodeSchema);

module.exports = Giftcode;
