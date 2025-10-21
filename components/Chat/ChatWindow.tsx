'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import { detectNodeChanges } from '@/lib/context-builder';

export default function ChatWindow() {
  const {
    chatMessages,
    closeChat,
    addChatMessage,
    clearChatHistory,
    chatWindowPosition,
    chatWindowSize,
    setChatWindowPosition,
    setChatWindowSize,
    nodes,
    initialNodeSnapshot,
    chatStartTimestamp,
    chatReferences,
    removeChatReference,
    clearChatReferences,
  } = useCanvasStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 调整大小状态
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();

    // 保存当前引用（拷贝一份）
    const currentReferences = [...chatReferences];

    // 构建发送给 API 的完整消息（包含引用内容）
    let apiMessage = '';
    if (currentReferences.length > 0) {
      apiMessage += '【引用内容】\n';
      currentReferences.forEach((ref, index) => {
        apiMessage += `${index + 1}. ${ref.content}\n`;
      });
      apiMessage += '\n';
    }
    apiMessage += userMessage;

    setInput('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      // 添加用户消息（只保存用户输入的文本，引用作为独立字段）
      await addChatMessage('user', userMessage, currentReferences.length > 0 ? currentReferences : undefined);

      // 检测节点变化
      const nodeChanges =
        initialNodeSnapshot && chatStartTimestamp
          ? detectNodeChanges(nodes, initialNodeSnapshot, chatStartTimestamp)
          : null;

      // 获取更新后的历史消息（不包括刚刚添加的用户消息，因为会在 API 中单独处理）
      const currentChatMessages = useCanvasStore.getState().chatMessages;

      // 准备 API 请求（发送完整消息包含引用）
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: apiMessage, // 发送包含引用的完整消息
          initialNodes: nodes,
          nodeChanges,
          chatHistory: currentChatMessages.slice(0, -1), // 不包括刚添加的用户消息
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullMessage += parsed.content;
                  setStreamingMessage(fullMessage);
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 保存完整的 AI 回复
      if (fullMessage) {
        await addChatMessage('assistant', fullMessage);
        setStreamingMessage('');
      }

      // 清空引用
      clearChatReferences();
    } catch (error) {
      console.error('Error sending message:', error);
      // 可以添加错误提示
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.chat-content, .chat-input')) {
      return; // 不在内容区域和输入区域触发拖拽
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - chatWindowPosition.x,
      y: e.clientY - chatWindowPosition.y,
    });
  };

  const handleDrag = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setChatWindowPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  }, [isDragging, dragOffset, setChatWindowPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 调整大小处理
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: chatWindowSize.width,
      height: chatWindowSize.height,
    });
  };

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      setChatWindowSize({
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(400, resizeStart.height + deltaY),
      });
    }
  }, [isResizing, resizeStart, setChatWindowSize]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDrag, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  return (
    <div
      ref={windowRef}
      className="fixed bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col overflow-hidden"
      style={{
        left: `${chatWindowPosition.x}px`,
        top: `${chatWindowPosition.y}px`,
        width: `${chatWindowSize.width}px`,
        height: `${chatWindowSize.height}px`,
        cursor: isDragging ? 'grabbing' : 'default',
        zIndex: 1000,
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 bg-white/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="font-semibold text-gray-900">AI 思维助手</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChatHistory}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="清空对话"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={closeChat}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 chat-content">
        {chatMessages.length === 0 && !streamingMessage && (
          <div className="text-center text-gray-400 mt-8">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p>开始与 AI 对话</p>
            <p className="text-xs mt-1">画布内容将作为上下文提供给 AI</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* 引用内容（仅用户消息） */}
              {msg.role === 'user' && msg.references && msg.references.length > 0 && (
                <div className="mb-1 space-y-1">
                  {msg.references.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-start gap-1.5 bg-gray-200/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-600"
                    >
                      <svg className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <div className="flex-1 line-clamp-2">
                        {ref.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 消息气泡 */}
              <div
                className={`rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-900">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>正在思考</span>
              </div>
            </div>
          </div>
        )}

        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-900">
              <div className="text-sm whitespace-pre-wrap break-words">{streamingMessage}</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-200/50 p-4 bg-white/50 chat-input">
        {/* 引用内容显示 */}
        {chatReferences.length > 0 && (
          <div className="mb-3 space-y-2">
            {chatReferences.map((ref) => (
              <div
                key={ref.id}
                className="flex items-start gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm"
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="flex-1 text-gray-600 line-clamp-2">
                  {ref.content}
                </div>
                <button
                  onClick={() => removeChatReference(ref.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  title="移除引用"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 调整大小手柄 */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg className="w-4 h-4 absolute bottom-1 right-1 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14 14V8h-1v5H8v1h5a1 1 0 001-1z"/>
          <path d="M8 10V5H7v4H3v1h4a1 1 0 001-1z"/>
        </svg>
      </div>
    </div>
  );
}
