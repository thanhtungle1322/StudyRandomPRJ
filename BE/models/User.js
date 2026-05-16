const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    avatar: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index cho tìm kiếm username nhanh
userSchema.index({ username: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
