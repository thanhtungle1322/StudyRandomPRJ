import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { connectSocket } from '../services/socket';
import { NotificationContext } from './notification-context';

export function NotificationProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return undefined;
    }

    const socket = connectSocket();

    // Nhận lời mời kết bạn
    const handleFriendRequest = (data) => {
      setNotifications(prev => [{
        id: data.friendshipId,
        type: 'friend_request',
        from: data.requester,
        createdAt: data.createdAt || new Date(),
        read: false,
      }, ...prev.filter((notification) => notification.id !== data.friendshipId)].slice(0, 50));
    };

    // Lời mời kết bạn được chấp nhận
    const handleFriendAccepted = (data) => {
      setNotifications(prev => [{
        id: 'accepted_' + data.friendshipId,
        type: 'friend_accepted',
        from: data.friend,
        createdAt: new Date(),
        read: false,
      }, ...prev.filter((notification) => notification.id !== `accepted_${data.friendshipId}`)].slice(0, 50));
    };

    // Nhận lời mời vào phòng học
    const handleRoomInvitation = (data) => {
      setNotifications(prev => [{
        id: data.invitationId,
        type: 'room_invitation',
        from: data.inviter,
        subject: data.subject,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
        read: false,
      }, ...prev.filter((notification) => notification.id !== data.invitationId)].slice(0, 50));
    };

    socket.on('friend:request_received', handleFriendRequest);
    socket.on('friend:request_accepted', handleFriendAccepted);
    socket.on('room:invitation_received', handleRoomInvitation);

    return () => {
      socket.off('friend:request_received', handleFriendRequest);
      socket.off('friend:request_accepted', handleFriendAccepted);
      socket.off('room:invitation_received', handleRoomInvitation);
    };
  }, [isLoggedIn]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((previous) => previous.map((notification) => (
      notification.read ? notification : { ...notification, read: true }
    )));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const pendingFriendRequests = notifications.filter(n => n.type === 'friend_request');
  const roomInvitations = notifications.filter(n => n.type === 'room_invitation');

  return (
    <NotificationContext.Provider value={{
      notifications, pendingFriendRequests, roomInvitations,
      unreadCount, removeNotification, clearAll, markAllRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
