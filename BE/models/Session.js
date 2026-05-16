const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    subject: {
      type: String,
      required: true,
    },
    users: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date },
      },
    ],
    messages: [messageSchema],
    status: {
      type: String,
      enum: ['active', 'ended', 'auto_disconnected'],
      default: 'active',
    },
    endedAt: {
      type: Date,
    },
    endReason: {
      type: String,
      enum: ['user_left', 'auto_disconnect', 'both_left', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// roomId index already created by unique:true
sessionSchema.index({ status: 1 });
sessionSchema.index({ 'users.userId': 1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
