import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  FiArrowLeft,
  FiTrash2,
  FiDownload,
  FiMaximize2,
  FiMinimize2,
  FiInfo,
} from 'react-icons/fi';
import './WhiteboardPage.css';

/**
 * WhiteboardPage — Standalone whiteboard (không có sync real-time)
 * Dùng để vẽ cá nhân / demo. Real-time sync chỉ có trong StudyRoom.
 */
export default function WhiteboardPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTip, setShowTip] = useState(true);

  const handleExcalidrawAPI = useCallback((api) => {
    setExcalidrawAPI(api);
  }, []);

  const handleClearCanvas = () => {
    if (!excalidrawAPI) return;
    if (window.confirm('Xóa toàn bộ bảng trắng?')) {
      excalidrawAPI.updateScene({ elements: [] });
    }
  };

  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png',
        quality: 1,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `studyrandom-whiteboard-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <div className={`whiteboard-page-new ${isFullscreen ? 'wb-fullscreen-page' : ''}`}>
      {/* ===== TOPBAR ===== */}
      <div className="wb-standalone-topbar">
        <div className="wb-standalone-left">
          <Link to="/lobby" className="wb-back-btn">
            <FiArrowLeft size={16} />
            <span>Sảnh chờ</span>
          </Link>
          <div className="wb-standalone-title">
            <span className="wb-standalone-icon">🎨</span>
            <div>
              <h1>Bảng Trắng Cá Nhân</h1>
              <p>Vẽ và ghi chú tự do — Real-time sync có trong phòng học</p>
            </div>
          </div>
        </div>

        <div className="wb-standalone-actions">
          <button className="wb-standalone-btn" onClick={handleClearCanvas} title="Xóa bảng">
            <FiTrash2 size={15} />
            <span>Xóa</span>
          </button>
          <button className="wb-standalone-btn" onClick={handleExportPNG} title="Xuất ảnh PNG">
            <FiDownload size={15} />
            <span>Xuất PNG</span>
          </button>
          <button
            className={`wb-standalone-btn ${isFullscreen ? 'wb-btn-active' : ''}`}
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFullscreen ? <FiMinimize2 size={15} /> : <FiMaximize2 size={15} />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* ===== TIP BANNER ===== */}
      {showTip && (
        <div className="wb-standalone-tip animate-fade-in">
          <FiInfo size={14} style={{ flexShrink: 0 }} />
          <span>
            💡 Muốn vẽ cùng bạn học real-time? Hãy vào{' '}
            <Link to="/lobby" style={{ color: '#845ef7', fontWeight: 700 }}>
              Phòng Học
            </Link>{' '}
            và bật nút <strong>🎨 Bảng Trắng</strong> trong control bar.
          </span>
          <button className="wb-tip-close" onClick={() => setShowTip(false)}>✕</button>
        </div>
      )}

      {/* ===== EXCALIDRAW CANVAS ===== */}
      <div className="wb-standalone-canvas">
        <Excalidraw
          excalidrawAPI={handleExcalidrawAPI}
          theme="dark"
          langCode="vi-VN"
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
          initialData={{
            appState: {
              viewBackgroundColor: '#13141f',
              theme: 'dark',
            },
          }}
        />
      </div>
    </div>
  );
}
