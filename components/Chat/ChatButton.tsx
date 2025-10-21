'use client';

import { useCanvasStore } from '@/lib/store';

export default function ChatButton() {
  const { toggleChat, isChatOpen } = useCanvasStore();

  return (
    <button
      onClick={toggleChat}
      className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all ${
        isChatOpen
          ? 'bg-blue-500 border-blue-600 text-white'
          : 'bg-white/70 backdrop-blur-xl border-gray-200/50 text-gray-600 hover:bg-white/90'
      }`}
      aria-label="AI 聊天助手"
      title="AI 聊天助手"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    </button>
  );
}
