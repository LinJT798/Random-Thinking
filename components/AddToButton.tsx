'use client';

import { createPortal } from 'react-dom';

interface AddToButtonProps {
  selectedText: string;
  position: { x: number; y: number };
  onClick: () => void;
}

export default function AddToButton({ selectedText, position, onClick }: AddToButtonProps) {
  if (!selectedText || typeof window === 'undefined') {
    return null;
  }

  return createPortal(
    <button
      data-add-to-button="true"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // 防止点击时清除选区
      className="fixed z-[2000] bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 transition-all duration-200 opacity-100"
      style={{
        left: `${position.x + 4}px`,
        top: `${position.y + 4}px`,
      }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span>Add to</span>
    </button>,
    document.body
  );
}
