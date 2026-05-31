const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const FriendDto = require('../dtos/friendDto');

class FriendService {
  /**
   * Send a friend request
   */
  async sendFriendRequest(requesterId, recipientId) {
    if (!recipientId) {
      throw { status: 400, message: 'Thiếu recipientId' };
    }

    if (requesterId.toString() === recipientId.toString()) {
      throw { status: 400, message: 'Không thể gửi lời mời cho chính mình' };
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw { status: 400, message: 'Đã là bạn bè' };
      }
      if (existing.status === 'pending') {
        throw { status: 400, message: 'Đã gửi lời mời rồi' };
      }
      if (existing.status === 'rejected') {
        await Friendship.deleteOne({ _id: existing._id });
      }
    }

    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
    });

    return friendship;
  }

  /**
   * Respond to friend request (accept/reject)
   */
  async respondToFriendRequest(userId, friendshipId, action) {
    if (!friendshipId || !action) {
      throw { status: 400, message: 'Thiếu friendshipId hoặc action' };
    }

    if (!['accept', 'reject'].includes(action)) {
      throw { status: 400, message: 'Action phải là accept hoặc reject' };
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      throw { status: 404, message: 'Không tìm thấy lời mời' };
    }

    if (friendship.recipient.toString() !== userId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền phản hồi lời mời này' };
    }

    if (friendship.status !== 'pending') {
      throw { status: 400, message: 'Lời mời đã được xử lý' };
    }

    friendship.status = action === 'accept' ? 'accepted' : 'rejected';
    await friendship.save();

    return friendship;
  }

  /**
   * Get friend list
   */
  async getFriendsList(userId) {
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' },
      ],
    })
      .populate('requester', 'displayName avatar isOnline lastSeen')
      .populate('recipient', 'displayName avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });

    return friendships.map((f) => FriendDto.toFriendItem(f, userId));
  }

  /**
   * Get pending requests list
   */
  async getPendingRequests(userId) {
    const pending = await Friendship.find({
      recipient: userId,
      status: 'pending',
    })
      .populate('requester', 'displayName avatar isOnline lastSeen')
      .sort({ createdAt: -1 });

    return pending.map((f) => FriendDto.toPendingRequestItem(f));
  }

  /**
   * Check friendship status with a specific user
   */
  async checkFriendshipStatus(currentUserId, targetUserId) {
    if (currentUserId.toString() === targetUserId.toString()) {
      return { status: 'self', friendshipId: null };
    }

    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: targetUserId },
        { requester: targetUserId, recipient: currentUserId },
      ],
    });

    if (!friendship) {
      return { status: 'none', friendshipId: null };
    }

    let status;
    if (friendship.status === 'accepted') {
      status = 'accepted';
    } else if (friendship.status === 'pending') {
      status = friendship.requester.toString() === currentUserId.toString() ? 'pending_sent' : 'pending_received';
    } else {
      status = 'none';
    }

    return { status, friendshipId: friendship._id };
  }

  /**
   * Delete friend relationship or cancel sent invitation
   */
  async deleteFriendship(userId, friendshipId) {
    if (!mongoose.Types.ObjectId.isValid(friendshipId)) {
      throw { status: 400, message: 'ID không hợp lệ' };
    }

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      throw { status: 404, message: 'Không tìm thấy quan hệ bạn bè' };
    }

    if (friendship.requester.toString() !== userId.toString() && friendship.recipient.toString() !== userId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền thực hiện thao tác này' };
    }

    await Friendship.deleteOne({ _id: friendshipId });
    return { success: true, message: 'Đã hủy kết bạn' };
  }
}

module.exports = new FriendService();
