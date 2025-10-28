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
      {/* 分割线 */}
      <div
        className={`fixed top-0 bottom-0 w-1 bg-gray-200/50 hover:bg-blue-400/50 transition-colors cursor-col-resize z-[1001] ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        style={{
          left: `${dockedWidth}vw`,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 拖动指示器 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-400/50 rounded-full pointer-events-none" />
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
