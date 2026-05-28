import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiCheck, FiBookOpen } from 'react-icons/fi';
import { useNotifications } from '../context/NotificationProvider';
import { getSocket } from '../services/socket';
import './InvitationToast.css';

const subjectNames = {
  math: 'Toán học',
  nodejs: 'Lập trình NodeJS',
  english: 'Tiếng Anh',
  python: 'Lập trình Python',
  react: 'React / Frontend',
  database: 'Cơ sở dữ liệu',
  algorithm: 'Thuật toán',
  physics: 'Vật lý',
  triet: 'Triết học',
  lichsu: 'Lịch sử',
  diali: 'Địa lí',
};

export default function InvitationToast() {
  const navigate = useNavigate();
  const { roomInvitations, removeNotification } = useNotifications();
  const [dismissedIds, setDismissedIds] = useState(new Set());

  // Lắng nghe sự kiện phòng được tạo sau khi chấp nhận lời mời
  useEffect(() => {
    const socket = getSocket();

    const handleInvitationAccepted = (data) => {
      if (data.roomId) {
        navigate(`/room/${data.roomId}`, {
          state: {
            subject: data.subject,
            partner: data.partner,
          },
        });
      }
    };

    socket.on('room:invitation_accepted', handleInvitationAccepted);
    return () => socket.off('room:invitation_accepted', handleInvitationAccepted);
  }, [navigate]);

  const handleRespond = useCallback((invitation, action) => {
    const socket = getSocket();
    socket.emit('room:invite_respond', {
      invitationId: invitation.id,
      inviterSocketId: invitation.inviterSocketId,
      inviterId: invitation.from?._id,
      subject: invitation.subject,
      action,
    });
    removeNotification(invitation.id);
    setDismissedIds(prev => new Set(prev).add(invitation.id));
  }, [removeNotification]);

  const handleDismiss = useCallback((id) => {
    removeNotification(id);
    setDismissedIds(prev => new Set(prev).add(id));
  }, [removeNotification]);

  // Tự động ẩn sau 60 giây
  const AutoDismissToast = ({ invitation }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        handleDismiss(invitation.id);
      }, 60000);
      return () => clearTimeout(timer);
    }, [invitation.id]);

    const name = invitation.from?.displayName || invitation.from?.username || 'Người dùng';
    const avatarSrc = invitation.from?.avatar
      || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    const subjectLabel = subjectNames[invitation.subject] || invitation.subject || 'môn học';

    return (
      <div className="invitation-toast">
        <div className="toast-header">
          <div className="toast-header-info">
            <img src={avatarSrc} alt="" className="toast-avatar" />
            <span className="toast-sender">{name}</span>
          </div>
          <button className="toast-close-btn" onClick={() => handleDismiss(invitation.id)}>
            <FiX />
          </button>
        </div>
        <div className="toast-body">
          <FiBookOpen style={{ color: '#845ef7', flexShrink: 0 }} />
          <p><strong>{name}</strong> mời bạn học <strong>{subjectLabel}</strong></p>
        </div>
        <div className="toast-actions">
          <button
            className="toast-accept-btn"
            onClick={() => handleRespond(invitation, 'accept')}
          >
            <FiCheck /> Tham gia
          </button>
          <button
            className="toast-reject-btn"
            onClick={() => handleRespond(invitation, 'reject')}
          >
            <FiX /> Từ chối
          </button>
        </div>
        <div className="toast-timer">
          <div className="toast-timer-bar" />
        </div>
      </div>
    );
  };

  const visibleInvitations = roomInvitations.filter(inv => !dismissedIds.has(inv.id));

  if (visibleInvitations.length === 0) return null;

  return (
    <div className="invitation-toast-container">
      {visibleInvitations.map(inv => (
        <AutoDismissToast key={inv.id} invitation={inv} />
      ))}
    </div>
  );
}
