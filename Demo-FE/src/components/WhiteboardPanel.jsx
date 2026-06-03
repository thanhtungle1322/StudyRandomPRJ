import { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { getSocket } from '../services/socket';
import { FiX, FiMaximize2, FiMinimize2, FiTrash2 } from 'react-icons/fi';
import './WhiteboardPanel.css';

/**
 * Hàm merge elements thông minh dựa trên version của từng element
 * Đảm bảo đồng bộ collaborative nhất quán và không ghi đè lên các thay đổi mới hơn
 */
const mergeElements = (localElements, remoteElements) => {
  const localMap = new Map((localElements ?? []).map(el => [el.id, el]));
  const remoteMap = new Map((remoteElements ?? []).map(el => [el.id, el]));
  const merged = [];
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (!local) {
      merged.push(remote);
    } else if (!remote) {
      merged.push(local);
    } else {
      // So sánh version để giữ lại bản mới nhất
      if (remote.version > local.version) {
        merged.push(remote);
      } else if (remote.version < local.version) {
        merged.push(local);
      } else {
        // Nếu version bằng nhau, so sánh versionNonce
        if (remote.versionNonce > local.versionNonce) {
          merged.push(remote);
        } else {
          merged.push(local);
        }
      }
    }
  }
  return merged;
};

export default function WhiteboardPanel({ roomId, isVisible, onClose }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wbMounted, setWbMounted] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const throttleTimerRef = useRef(null);
  const excalidrawAPIRef = useRef(null);

  // Lưu trữ map id -> version của các elements ở scene gần nhất để tránh loop
  const lastSceneVersionsRef = useRef(new Map());

  // Theo dõi xem đã từng có elements chưa — để phân biệt init rỗng vs xóa chủ ý
  const hadElementsRef = useRef(false);

  // Mount Excalidraw sau 120ms để DOM ổn định (fix cursor offset)
  useEffect(() => {
    const timer = setTimeout(() => setWbMounted(true), 120);
    return () => {
      clearTimeout(timer);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Tự động làm mới (refresh) layout của Excalidraw khi bảng trắng hiển thị lại từ trạng thái ẩn
  useEffect(() => {
    if (isVisible && excalidrawAPI) {
      const timer = setTimeout(() => {
        try {
          excalidrawAPI.refresh();
        } catch (e) {
          console.warn('[Whiteboard] excalidrawAPI.refresh error:', e);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, excalidrawAPI]);

  const handleExcalidrawAPI = useCallback((api) => {
    setExcalidrawAPI(api);
    excalidrawAPIRef.current = api;
  }, []);

  // ===== SOCKET LISTENERS =====
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Nhận update vẽ từ partner
    const handleWhiteboardUpdate = ({ elements, appState }) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;

      const incomingElements = elements ?? [];
      const currentElements = api.getSceneElements() ?? [];

      // GUARD: Không cho elements rỗng từ partner init overwrite canvas có nội dung
      // Chỉ apply update rỗng nếu canvas của mình cũng đang rỗng
      const incomingNonDeleted = incomingElements.filter(el => !el.isDeleted);
      const currentNonDeleted = currentElements.filter(el => !el.isDeleted);

      if (incomingNonDeleted.length === 0 && currentNonDeleted.length > 0) {
        console.log('[Whiteboard] Ignoring empty update from partner (likely init broadcast)');
        return;
      }

      // Merge elements thông minh
      const mergedElements = mergeElements(currentElements, incomingElements);

      // Cập nhật lastSceneVersionsRef trước khi updateScene để tránh feedback loop trong onChange
      const newVersions = new Map();
      mergedElements.forEach(el => {
        newVersions.set(el.id, el.version);
      });
      lastSceneVersionsRef.current = newVersions;

      try {
        api.updateScene({
          elements: mergedElements,
          appState: { viewBackgroundColor: appState?.viewBackgroundColor },
        });
        if (incomingNonDeleted.length > 0) hadElementsRef.current = true;
      } catch (e) {
        console.error('[Whiteboard] updateScene error:', e);
      }
    };

    // Partner yêu cầu gửi state hiện tại để sync khi họ mới mở whiteboard
    const handleSendSync = () => {
      const api = excalidrawAPIRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      socket.emit('whiteboard:sync_response', {
        roomId,
        elements,
        appState: { viewBackgroundColor: appState?.viewBackgroundColor },
      });
    };

    // Partner xóa bảng có chủ ý (từ nút "Xóa bảng")
    const handleClear = () => {
      const api = excalidrawAPIRef.current;
      if (!api) return;

      // Reset phiên bản lưu trữ
      lastSceneVersionsRef.current = new Map();

      api.updateScene({ elements: [] });
      hadElementsRef.current = false;
    };

    socket.on('whiteboard:update', handleWhiteboardUpdate);
    socket.on('whiteboard:send_sync', handleSendSync);
    socket.on('whiteboard:sync_response', handleWhiteboardUpdate);
    socket.on('whiteboard:clear', handleClear);

    // Yêu cầu partner gửi state hiện tại khi mở whiteboard
    socket.emit('whiteboard:request_sync', { roomId });

    return () => {
      socket.off('whiteboard:update', handleWhiteboardUpdate);
      socket.off('whiteboard:send_sync', handleSendSync);
      socket.off('whiteboard:sync_response', handleWhiteboardUpdate);
      socket.off('whiteboard:clear', handleClear);
    };
  }, [roomId]);

  // ===== ONCHANGE — Đồng bộ thông minh dựa trên phiên bản thực tế =====
  const handleChange = useCallback(
    (elements, appState) => {
      const nonDeleted = (elements ?? []).filter(el => !el.isDeleted);

      // GUARD: Không broadcast elements rỗng trừ khi đã từng có nội dung
      if (nonDeleted.length === 0 && !hadElementsRef.current) return;

      // 1. So sánh version của các elements hiện tại so với phiên bản gửi/nhận gần nhất
      let hasChanges = false;
      const currentVersions = lastSceneVersionsRef.current;

      if (elements.length !== currentVersions.size) {
        hasChanges = true;
      } else {
        for (const el of elements) {
          const lastVersion = currentVersions.get(el.id);
          if (lastVersion === undefined || lastVersion !== el.version) {
            hasChanges = true;
            break;
          }
        }
      }

      // Nếu không có thay đổi nào thực sự về mặt dữ liệu vẽ, dừng lại (tránh loop)
      if (!hasChanges) return;

      // Cập nhật flag khi có elements
      if (nonDeleted.length > 0) hadElementsRef.current = true;

      // Cập nhật lại bản đồ phiên bản hiện tại trước khi gửi
      const newVersions = new Map();
      elements.forEach(el => {
        newVersions.set(el.id, el.version);
      });
      lastSceneVersionsRef.current = newVersions;

      // Throttle gửi tin qua socket để tránh overload mạng
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = setTimeout(() => {
        const socket = getSocket();
        if (!socket || !roomId) return;
        socket.emit('whiteboard:update', {
          roomId,
          elements: elements ?? [],
          appState: { viewBackgroundColor: appState?.viewBackgroundColor },
        });
      }, 80);
    },
    [roomId]
  );

  // ===== CLEAR BOARD — dùng event riêng, không qua whiteboard:update =====
  const handleClearBoard = () => {
    if (!excalidrawAPI) return;
    setShowConfirmClear(true);
  };

  const confirmClearBoard = () => {
    if (!excalidrawAPI) return;

    // Reset phiên bản lưu trữ
    lastSceneVersionsRef.current = new Map();

    excalidrawAPI.updateScene({ elements: [] });
    hadElementsRef.current = false;

    // Dùng whiteboard:clear event — không bị lọc bởi guard empty elements
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('whiteboard:clear', { roomId });
    }
    setShowConfirmClear(false);
  };

  return (
    <>
      <div className={`whiteboard-panel-overlay ${isFullscreen ? 'wb-fullscreen' : ''} ${!isVisible ? 'wb-hidden' : ''}`}>
        <div className="whiteboard-panel-container">

          {/* ── Header ── */}
          <div className="wb-panel-header">
            <div className="wb-panel-title">
              <span className="wb-panel-icon">🎨</span>
              <span>Bảng Trắng Chung</span>
              <span className="wb-panel-live-badge">
                <span className="wb-live-dot" />
                Realtime
              </span>
            </div>
            <div className="wb-panel-actions">
              <button className="wb-action-btn wb-clear-btn" onClick={handleClearBoard} title="Xóa bảng">
                <FiTrash2 size={15} />
                <span>Xóa bảng</span>
              </button>
              <button
                className="wb-action-btn"
                onClick={() => setIsFullscreen((f) => !f)}
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
              </button>
              <button className="wb-action-btn wb-close-btn" onClick={onClose} title="Đóng bảng trắng">
                <FiX size={18} />
              </button>
            </div>
          </div>

          {/* ── Excalidraw Canvas ── */}
          <div className="wb-excalidraw-wrapper">
            {wbMounted ? (
              <Excalidraw
                excalidrawAPI={handleExcalidrawAPI}
                onChange={handleChange}
                theme="dark"
                langCode="vi-VN"
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: true,
                    clearCanvas: false,   // Tắt nút clear mặc định, dùng nút custom
                    export: false,
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                  },
                  tools: { image: false },
                }}
                initialData={{
                  appState: {
                    viewBackgroundColor: '#1a1b26',
                    theme: 'dark',
                  },
                }}
              />
            ) : (
              <div className="wb-loading-placeholder">
                <div className="wb-loading-spinner" />
                <span>Đang tải bảng trắng...</span>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="wb-panel-footer">
            <span>💡 Cả hai người có thể vẽ cùng lúc — thay đổi hiển thị ngay lập tức</span>
          </div>

        </div>
      </div>

      {/* Custom Confirm Modal Popup */}
      {showConfirmClear && (
        <div className="wb-confirm-overlay" onClick={() => setShowConfirmClear(false)}>
          <div className="wb-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wb-confirm-icon">⚠️</div>
            <h3>Xóa bảng trắng?</h3>
            <p>Hành động này sẽ xóa sạch toàn bộ hình vẽ hiện tại trên bảng trắng của cả hai người và không thể hoàn tác.</p>
            <div className="wb-confirm-actions">
              <button className="wb-btn wb-btn-danger" onClick={confirmClearBoard}>
                Xác nhận xóa
              </button>
              <button className="wb-btn wb-btn-secondary" onClick={() => setShowConfirmClear(false)}>
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
