const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
    },
    displayName: {
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
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    premiumPurchasedAt: {
      type: Date,
      default: null,
    },
    // ---- Free Plan Limits ----
    dailyMatchCount: {
      type: Number,
      default: 0,
    },
    lastMatchDate: {
      type: String, // YYYY-MM-DD format
      default: null,
    },
    // ---- Reputation System ----
    reputation: {
      type: Number,
      default: 5.0,
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
      default: [],
    },
    // ---- Custom Profile Customization (Discord-like) ----
    nickname: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    interests: {
      type: [String],
      default: [],
    },
    themeColor: {
      type: String,
      default: '#7c3aed', // Default purple color
    },
    themeGradient: {
      type: String,
      default: 'linear-gradient(135deg, #7c3aed, #4f46e5)', // Default theme gradient
    },
    banner: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ displayName: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
