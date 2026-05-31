class FriendDto {
  /**
   * Format friend list items
   */
  static toFriendItem(friendship, userId) {
    if (!friendship) return null;
    const friend = friendship.requester._id.toString() === userId.toString() 
      ? friendship.recipient 
      : friendship.requester;

    return {
      friendshipId: friendship._id,
      user: {
        _id: friend._id,
        displayName: friend.displayName,
        avatar: friend.avatar,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
      },
    };
  }

  /**
   * Format pending requests items
   */
  static toPendingRequestItem(friendship) {
    if (!friendship || !friendship.requester) return null;
    return {
      friendshipId: friendship._id,
      requester: {
        _id: friendship.requester._id,
        displayName: friendship.requester.displayName,
        avatar: friendship.requester.avatar,
        isOnline: friendship.requester.isOnline,
        lastSeen: friendship.requester.lastSeen,
      },
      createdAt: friendship.createdAt,
    };
  }
}

module.exports = FriendDto;
