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
    // ---- Reputation System ----
    reputation: {
      type: Number,
      default: 5.0, // Start with a perfect score or maybe 0? 5 is better for MVP
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    // ---- Study Statistics ----
    totalStudyMinutes: {
      type: Number,
      default: 0,
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastStudyDate: {
      type: Date,
    },
    // ---- Gamification ----
    badges: {
      type: [String],
      default: [], // e.g. "FIRST_SESSION", "10_HOURS", "STREAK_7_DAYS"
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
