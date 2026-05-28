const express = require('express');
const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/friends/request
 * Gửi lời mời kết bạn
 */
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.userId;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Thiếu recipientId' });
    }

    if (requesterId === recipientId) {
      return res.status(400).json({ success: false, message: 'Không thể gửi lời mời cho chính mình' });
    }

    // Kiểm tra user tồn tại
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra friendship đã tồn tại (cả 2 chiều)
    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Đã là bạn bè' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ success: false, message: 'Đã gửi lời mời rồi' });
      }
      // Nếu bị rejected trước đó → xóa cũ và tạo mới
      if (existing.status === 'rejected') {
        await Friendship.deleteOne({ _id: existing._id });
      }
    }

    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
    });

    res.status(201).json({ success: true, friendship, message: 'Đã gửi lời mời kết bạn' });
  } catch (error) {
    console.error('[Friends] Request error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * PUT /api/friends/respond
 * Chấp nhận hoặc từ chối lời mời kết bạn
 */
router.put('/respond', authenticateToken, async (req, res) => {
  try {
    const { friendshipId, action } = req.body;
    const userId = req.user.userId;

    if (!friendshipId || !action) {
      return res.status(400).json({ success: false, message: 'Thiếu friendshipId hoặc action' });
    }

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action phải là accept hoặc reject' });
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời' });
    }

    // Chỉ recipient mới có thể phản hồi
    if (friendship.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền phản hồi lời mời này' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Lời mời đã được xử lý' });
    }

    friendship.status = action === 'accept' ? 'accepted' : 'rejected';
    await friendship.save();

    const message = action === 'accept' ? 'Đã chấp nhận lời mời kết bạn' : 'Đã từ chối lời mời kết bạn';
    res.json({ success: true, friendship, message });
  } catch (error) {
    console.error('[Friends] Respond error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * GET /api/friends
 * Lấy danh sách bạn bè (chỉ accepted)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' },
      ],
    })
      .populate('requester', 'displayName avatar isOnline lastSeen')
      .populate('recipient', 'displayName avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });

    // Trả về info của người kia (không phải current user)
    const friends = friendships.map((f) => {
      const friend = f.requester._id.toString() === userId ? f.recipient : f.requester;
      return {
        friendshipId: f._id,
        user: {
          _id: friend._id,
          displayName: friend.displayName,
          avatar: friend.avatar,
          isOnline: friend.isOnline,
          lastSeen: friend.lastSeen,
        },
      };
    });

    res.json({ success: true, friends });
  } catch (error) {
    console.error('[Friends] Get list error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * GET /api/friends/pending
 * Lấy danh sách lời mời kết bạn đang chờ (mình là recipient)
 */
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const pending = await Friendship.find({
      recipient: userId,
      status: 'pending',
    })
      .populate('requester', 'displayName avatar isOnline lastSeen')
      .sort({ createdAt: -1 });

    const requests = pending.map((f) => ({
      friendshipId: f._id,
      requester: {
        _id: f.requester._id,
        displayName: f.requester.displayName,
        avatar: f.requester.avatar,
        isOnline: f.requester.isOnline,
        lastSeen: f.requester.lastSeen,
      },
      createdAt: f.createdAt,
    }));

    res.json({ success: true, requests });
  } catch (error) {
    console.error('[Friends] Get pending error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * GET /api/friends/status/:userId
 * Kiểm tra trạng thái kết bạn với một user cụ thể
 */
router.get('/status/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.json({ success: true, status: 'self', friendshipId: null });
    }

    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: targetUserId },
        { requester: targetUserId, recipient: currentUserId },
      ],
    });

    if (!friendship) {
      return res.json({ success: true, status: 'none', friendshipId: null });
    }

    let status;
    if (friendship.status === 'accepted') {
      status = 'accepted';
    } else if (friendship.status === 'pending') {
      status = friendship.requester.toString() === currentUserId ? 'pending_sent' : 'pending_received';
    } else {
      status = 'none'; // rejected → coi như chưa kết bạn
    }

    res.json({ success: true, status, friendshipId: friendship._id });
  } catch (error) {
    console.error('[Friends] Check status error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/friends/:friendshipId
 * Hủy kết bạn hoặc hủy lời mời đã gửi
 */
router.delete('/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(friendshipId)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy quan hệ bạn bè' });
    }

    // Chỉ requester hoặc recipient mới có quyền xóa
    if (friendship.requester.toString() !== userId && friendship.recipient.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
    }

    await Friendship.deleteOne({ _id: friendshipId });

    res.json({ success: true, message: 'Đã hủy kết bạn' });
  } catch (error) {
    console.error('[Friends] Delete error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;

