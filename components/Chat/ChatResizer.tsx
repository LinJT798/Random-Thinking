'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

export default function ChatResizer() {
  const { dockedChatId, dockedWidth, setDockedWidth } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    // 计算新的宽度百分比
    const newWidth = (e.clientX / window.innerWidth) * 100;

    // 限制在 30-50% 之间
    const clampedWidth = Math.max(30, Math.min(50, newWidth));

    setDockedWidth(clampedWidth);
  }, [isDragging, setDockedWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 如果没有固定的聊天窗口，不渲染
  if (!dockedChatId) return null;

  return (
    <>
      {/* 分割线 - 纸感配色 */}
      <div
        className="fixed top-0 bottom-0 w-1 cursor-col-resize z-[1001] transition-all duration-300"
        style={{
          left: `${dockedWidth}vw`,
          background: isDragging ? 'rgba(139, 142, 99, 0.6)' : 'rgba(122, 111, 103, 0.2)',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'rgba(139, 142, 99, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'rgba(122, 111, 103, 0.2)';
          }
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 拖动指示器 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full pointer-events-none transition-colors" style={{
          background: isDragging ? 'rgba(139, 142, 99, 0.7)' : 'rgba(122, 111, 103, 0.3)',
        }} />
      </div>

      {/* 全屏遮罩 - 拖动时防止鼠标事件干扰 */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[1000] cursor-col-resize"
          style={{ backgroundColor: 'transparent' }}
        />
      )}
    </>
  );
}
