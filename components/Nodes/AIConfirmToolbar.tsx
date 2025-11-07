'use client';

import { useCanvasStore } from '@/lib/store';

interface AIConfirmToolbarProps {
  nodeId: string;
  chatId: string;
  messageId: string;
  toolIndex: number;
  nodeWidth: number; // 节点宽度，用于居中对齐
}

export default function AIConfirmToolbar({
  nodeId,
  chatId,
  messageId,
  toolIndex,
  nodeWidth,
}: AIConfirmToolbarProps) {
  const { confirmToolCall, rejectToolCall } = useCanvasStore();

  const handleConfirm = async () => {
    await confirmToolCall(chatId, messageId, toolIndex);
  };

  const handleReject = async () => {
    await rejectToolCall(chatId, messageId, toolIndex);
  };

  return (
    <div
      className="absolute pointer-events-auto z-[1000]"
      style={{
        left: '50%',
        top: 'calc(100% + 15px)', // 节点下方 15px
        transform: 'translateX(-50%)', // 居中对齐
      }}
    >
      {/* 指示箭头 - 移到顶部，向上指 */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: '100%',
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: '4px solid rgba(237, 228, 213, 0.95)',
          filter: 'drop-shadow(0 -1px 2px rgba(61, 52, 44, 0.1))',
        }}
      />

      <div
        className="flex flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-effect animate-in fade-in-0 zoom-in-95"
        style={{
          background: 'rgba(237, 228, 213, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 3px 10px rgba(61, 52, 44, 0.15)',
        }}
      >
        {/* 保留按钮 */}
        <button
          onClick={handleConfirm}
          className="flex flex-row items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap"
          style={{
            background: 'rgba(139, 142, 99, 0.2)',
            border: '1px solid rgba(139, 142, 99, 0.35)',
            color: '#8B8E63',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 142, 99, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.5)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(139, 142, 99, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(139, 142, 99, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.35)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="确认保留这个节点"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>保留</span>
        </button>

        {/* 删除按钮 */}
        <button
          onClick={handleReject}
          className="flex flex-row items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap"
          style={{
            background: 'rgba(122, 111, 103, 0.15)',
            border: '1px solid rgba(122, 111, 103, 0.2)',
            color: '#7A6F67',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(122, 111, 103, 0.25)';
            e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.35)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(122, 111, 103, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(122, 111, 103, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="删除这个节点"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>删除</span>
        </button>
      </div>
    </div>
  );
}
