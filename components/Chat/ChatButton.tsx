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
      {/* 主聊天按钮 - 纸感风格 */}
      <button
        onClick={handleMainButtonClick}
        className="w-10 h-10 flex items-center justify-center rounded-xl transition-all backdrop-blur-xl"
        style={{
          background: 'rgba(237, 228, 213, 0.85)',
          boxShadow: '0 4px 12px rgba(61, 52, 44, 0.08)',
          border: '1px solid rgba(122, 111, 103, 0.15)',
          color: '#3D342C',
        }}
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
          {/* 现有的聊天会话按钮 - 纸感风格 */}
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
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all text-sm font-medium backdrop-blur-xl"
              style={{
                background: session.isOpen ? 'rgba(139, 142, 99, 0.9)' : 'rgba(237, 228, 213, 0.85)',
                boxShadow: '0 4px 12px rgba(61, 52, 44, 0.08)',
                border: session.isOpen ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.15)',
                color: session.isOpen ? '#fff' : '#7A6F67',
              }}
              title={session.name}
            >
              {session.name.charAt(0)}
            </button>
          ))}

          {/* 添加新聊天按钮 - 焦糖橙 */}
          <button
            onClick={() => {
              createChatSession();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all backdrop-blur-xl"
            style={{
              background: 'rgba(180, 114, 60, 0.9)',
              boxShadow: '0 4px 12px rgba(61, 52, 44, 0.08)',
              border: '1px solid rgba(180, 114, 60, 1)',
              color: '#fff',
            }}
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
