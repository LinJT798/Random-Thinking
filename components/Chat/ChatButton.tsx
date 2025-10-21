'use client';

import { useCanvasStore } from '@/lib/store';

export default function ChatButton() {
  const {
    chatSessions,
    chatListExpanded,
    toggleChatList,
    createChatSession,
    switchChat,
    closeChatSession,
  } = useCanvasStore();

  const handleMainButtonClick = () => {
    // 只切换列表展开状态，不创建聊天
    toggleChatList();
  };

  return (
    <div className="flex flex-col gap-1">
      {/* 主聊天按钮 */}
      <button
        onClick={handleMainButtonClick}
        className="w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all bg-white/70 backdrop-blur-xl border-gray-200/50 text-gray-600 hover:bg-white/90"
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

      {/* 展开的聊天列表 */}
      {chatListExpanded && (
        <div className="flex flex-col gap-1 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* 现有的聊天会话按钮 */}
          {chatSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                if (session.isOpen) {
                  closeChatSession(session.id);
                } else {
                  switchChat(session.id);
                }
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all text-sm font-medium ${
                session.isOpen
                  ? 'bg-blue-400 border-blue-500 text-white'
                  : 'bg-white/70 backdrop-blur-xl border-gray-200/50 text-gray-600 hover:bg-white/90'
              }`}
              title={session.name}
            >
              {session.name.charAt(0)}
            </button>
          ))}

          {/* 添加新聊天按钮（+号，始终在最下面） */}
          <button
            onClick={() => {
              createChatSession();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border transition-all bg-green-500/90 border-green-600 text-white hover:bg-green-600"
            title="创建新聊天"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
