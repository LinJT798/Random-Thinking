'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import { detectNodeChanges } from '@/lib/context-builder';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  // All hooks must come first before any conditional returns
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

  // 标题编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    chatSessions,
    closeChatSession,
    addChatMessage,
    deleteChatSession,
    setChatWindowPosition,
    setChatWindowSize,
    updateChatName,
    addNode,
    nodes,
    removeChatReference,
    clearChatReferences,
  } = useCanvasStore();

  // Get the specific chat session
  const session = chatSessions.find(s => s.id === chatId);

  // 自动滚焦到标题输入框
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (session) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session, session?.messages, streamingMessage]);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();

    // 保存当前引用（拷贝一份）
    const currentReferences = [...session.references];

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
      await addChatMessage(chatId, 'user', userMessage, currentReferences.length > 0 ? currentReferences : undefined);

      // 检测节点变化
      const nodeChanges = detectNodeChanges(nodes, session.initialNodeSnapshot, session.startTimestamp);

      // 获取更新后的历史消息（不包括刚刚添加的用户消息，因为会在 API 中单独处理）
      const currentSession = useCanvasStore.getState().chatSessions.find(s => s.id === chatId);
      const currentChatMessages = currentSession?.messages || [];

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
          useThinking: session.useThinking, // 是否启用 Extended Thinking
          useWebSearch: session.useWebSearch, // 是否启用 Web Search
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: await response.text() };
        }
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Failed to get response from AI: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`);
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

                // 处理普通文本内容
                if (parsed.type === 'text' && parsed.content) {
                  fullMessage += parsed.content;
                  setStreamingMessage(fullMessage);
                }

                // 向后兼容：如果没有 type 字段，默认当作文本
                if (!parsed.type && parsed.content) {
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
        await addChatMessage(chatId, 'assistant', fullMessage);
        setStreamingMessage('');
      }

      // 清空引用
      clearChatReferences(chatId);
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

  // 开始编辑标题
  const handleStartEditTitle = () => {
    if (!session) return;
    setTitleInput(session.name);
    setIsEditingTitle(true);
  };

  // 保存标题
  const handleSaveTitle = () => {
    if (titleInput.trim() && titleInput !== session?.name) {
      updateChatName(chatId, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  // 取消编辑标题
  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
  };

  // 标题输入框键盘事件
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditTitle();
    }
  };

  // 找到最佳的节点放置位置
  const findBestPosition = () => {
    const nodeWidth = 300;
    const nodeHeight = 200;
    const spacing = 50; // 节点之间的间距

    // 如果没有节点，放在屏幕中心
    if (nodes.length === 0) {
      return {
        x: window.innerWidth / 2 - nodeWidth / 2,
        y: window.innerHeight / 2 - nodeHeight / 2,
      };
    }

    // 找到最近创建的节点（最大的 createdAt）
    const latestNode = nodes.reduce((latest, node) =>
      node.createdAt > latest.createdAt ? node : latest
    );

    // 尝试在最近节点的右侧放置
    let newX = latestNode.position.x + latestNode.size.width + spacing;
    let newY = latestNode.position.y;

    // 检查右侧位置是否与其他节点重叠
    const wouldOverlap = (x: number, y: number) => {
      return nodes.some(node => {
        const horizontalOverlap =
          x < node.position.x + node.size.width + spacing &&
          x + nodeWidth + spacing > node.position.x;
        const verticalOverlap =
          y < node.position.y + node.size.height + spacing &&
          y + nodeHeight + spacing > node.position.y;
        return horizontalOverlap && verticalOverlap;
      });
    };

    // 如果右侧有重叠，尝试下方
    if (wouldOverlap(newX, newY)) {
      newX = latestNode.position.x;
      newY = latestNode.position.y + latestNode.size.height + spacing;
    }

    // 如果下方也有重叠，尝试右下方
    if (wouldOverlap(newX, newY)) {
      newX = latestNode.position.x + latestNode.size.width + spacing;
      newY = latestNode.position.y + latestNode.size.height + spacing;
    }

    return { x: newX, y: newY };
  };

  // 将消息添加到画布
  const handleAddToCanvas = async (content: string) => {
    if (!session) return;

    // 找到最佳放置位置
    const position = findBestPosition();

    // 创建节点
    const nodeId = await addNode({
      type: 'text',
      content: content,
      position,
      size: { width: 300, height: 200 },
      connections: [],
    });

    // 触发视角移动事件
    if (nodeId) {
      // 使用自定义事件通知 Canvas 移动视角
      window.dispatchEvent(new CustomEvent('focusNode', {
        detail: {
          x: position.x + 150,  // 节点中心 x
          y: position.y + 100   // 节点中心 y
        }
      }));
    }
  };

  // 拖拽处理
  const handleDrag = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setChatWindowPosition(chatId, {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  }, [isDragging, dragOffset, chatId, setChatWindowPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.chat-content, .chat-input')) {
      return; // 不在内容区域和输入区域触发拖拽
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - (session?.position.x || 0),
      y: e.clientY - (session?.position.y || 0),
    });
  };

  // 调整大小处理
  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      setChatWindowSize(chatId, {
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(400, resizeStart.height + deltaY),
      });
    }
  }, [isResizing, resizeStart, chatId, setChatWindowSize]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: session?.size.width || 400,
      height: session?.size.height || 600,
    });
  };

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

  // Early return after all hooks
  if (!session) {
    return null; // Session doesn't exist
  }

  return (
    <div
      ref={windowRef}
      className="fixed bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col overflow-hidden"
      style={{
        left: `${session.position.x}px`,
        top: `${session.position.y}px`,
        width: `${session.size.width}px`,
        height: `${session.size.height}px`,
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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              className="flex-1 font-semibold text-gray-900 bg-white/80 border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors truncate"
              onClick={(e) => {
                e.stopPropagation();
                handleStartEditTitle();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="点击编辑标题"
            >
              {session.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deleteChatSession(chatId)}
            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-gray-500"
            title="删除对话"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={() => closeChatSession(chatId)}
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
        {session.messages.length === 0 && !streamingMessage && (
          <div className="text-center text-gray-400 mt-8">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p>开始与 AI 对话</p>
            <p className="text-xs mt-1">画布内容将作为上下文提供给 AI</p>
          </div>
        )}

        {session.messages.map((msg) => (
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

              {/* AI 消息的添加到画布按钮 */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => handleAddToCanvas(msg.content)}
                  className="mt-1 text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                  title="添加到画布"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>添加到画布</span>
                </button>
              )}
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

        {/* AI 回复文本显示 */}
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
        {session.references.length > 0 && (
          <div className="mb-3 space-y-2">
            {session.references.map((ref) => (
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
                  onClick={() => removeChatReference(chatId, ref.id)}
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
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
