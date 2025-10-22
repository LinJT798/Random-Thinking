'use client';

import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

export default function DraggingTextBubble() {
  const { draggingText } = useCanvasStore();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!draggingText) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [draggingText]);

  if (!draggingText) return null;

  // 截断文本显示
  const displayText = draggingText.length > 50
    ? draggingText.substring(0, 50) + '...'
    : draggingText;

  return (
    <div
      className="fixed z-[3000] pointer-events-none"
      style={{
        left: `${mousePosition.x + 16}px`,
        top: `${mousePosition.y + 16}px`,
      }}
    >
      <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-lg px-3 py-2 border border-blue-200 max-w-xs">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">点击添加到</div>
            <div className="text-sm text-gray-900 break-words">{displayText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
