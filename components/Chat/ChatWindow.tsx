'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import { useTextSelection } from '@/hooks/useTextSelection';
import AddToButton from '../AddToButton';
import { detectNodeChanges } from '@/lib/context-builder';
import { calculateTextNodeSize } from '@/lib/text-size-calculator';
import { createMindMapNetwork } from '@/lib/mindmap-creator';
import { findNonOverlappingPosition } from '@/lib/smart-layout';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  // All hooks must come first before any conditional returns
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [toolCallStatus, setToolCallStatus] = useState<string>('');
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

  // 文本选中功能
  const { selectedText, selectionPosition, handleTextSelection, handleAddToClick } = useTextSelection();

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
    draggingText,
    setDraggingText,
    addChatReference,
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

  // 处理工具调用
  const handleToolCall = async (toolName: string, input: any) => {
    const toolLabels: Record<string, string> = {
      'add_text_node': '正在创建文本框...',
      'add_sticky_note': '正在创建便签...',
      'create_mindmap': '正在创建思维导图...'
    };

    setToolCallStatus(toolLabels[toolName] || '正在执行操作...');

    try {
      // 获取最新的 nodes 状态（确保看到刚刚创建的节点）
      const currentNodes = useCanvasStore.getState().nodes;

      switch (toolName) {
        case 'add_text_node': {
          const size = calculateTextNodeSize(input.content);

          const position = input.position || findNonOverlappingPosition({
            width: size.width,
            height: size.height,
            nodes: currentNodes
          });

          await addNode({
            type: 'text',
            content: input.content,
            position,
            size,
            connections: [],
          });
          break;
        }

        case 'add_sticky_note': {
          const position = findNonOverlappingPosition({
            width: 200,
            height: 200,
            nodes: currentNodes
          });

          await addNode({
            type: 'sticky',
            content: input.content,
            position,
            size: { width: 200, height: 200 },
            color: input.color || 'yellow',
            connections: [],
          });
          break;
        }

        case 'create_mindmap': {
          // 思维导图会展开，预留超大空间
          const position = findNonOverlappingPosition({
            width: 2000,
            height: 1200,
            nodes: currentNodes
          });

          await createMindMapNetwork(input.root, input.children || [], {
            addNode,
            startPosition: position,
            getAllNodes: () => useCanvasStore.getState().nodes
          });
          break;
        }
      }

      setTimeout(() => setToolCallStatus(''), 1000);
    } catch (error) {
      console.error('Tool call failed:', error);
      setToolCallStatus('');
    }
  };

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading || !session) return;

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
      let hasToolCalls = false;

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

                // 处理工具调用
                if (parsed.type === 'tool_use') {
                  hasToolCalls = true;
                  await handleToolCall(parsed.tool, parsed.input);
                  // 添加工具调用反馈到消息中
                  const toolNames: Record<string, string> = {
                    'add_text_node': '已创建文本框',
                    'add_sticky_note': '已创建便签',
                    'create_mindmap': '已创建思维导图'
                  };
                  fullMessage += `\n\n✨ ${toolNames[parsed.tool] || '已执行操作'}`;
                  setStreamingMessage(fullMessage);
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 保存完整的 AI 回复（即使只有工具调用也要保存）
      if (fullMessage || hasToolCalls) {
        await addChatMessage(chatId, 'assistant', fullMessage || '✨ 已完成操作');
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

  // 处理输入区域点击（添加拖拽的文本作为引用）
  const handleInputAreaClick = (e: React.MouseEvent) => {
    if (draggingText) {
      e.preventDefault();
      e.stopPropagation();

      // 添加为引用
      addChatReference(chatId, 'dragged-text', draggingText);

      // 清除拖拽文本
      setDraggingText(null);

      // 聚焦输入框
      inputRef.current?.focus();
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

  // 将消息添加到画布
  const handleAddToCanvas = async (content: string) => {
    if (!session) return;

    // 计算文本所需尺寸
    const size = calculateTextNodeSize(content);

    // 获取最新的 nodes 状态
    const currentNodes = useCanvasStore.getState().nodes;

    // 使用智能布局找到无重叠位置
    const position = findNonOverlappingPosition({
      width: size.width,
      height: size.height,
      nodes: currentNodes
    });

    // 创建节点
    const nodeId = await addNode({
      type: 'text',
      content: content,
      position,
      size,
      connections: [],
    });

    // 触发视角移动事件
    if (nodeId) {
      window.dispatchEvent(new CustomEvent('focusNode', {
        detail: {
          x: position.x + size.width / 2,
          y: position.y + size.height / 2
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
    <>
      {/* Add to 按钮 */}
      {selectedText && selectionPosition && (
        <AddToButton
          selectedText={selectedText}
          position={selectionPosition}
          onClick={handleAddToClick}
        />
      )}

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
                className={`rounded-2xl px-4 py-2 relative ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900 select-text cursor-text'
                }`}
                onMouseUp={(e) => msg.role === 'assistant' && handleTextSelection(e)}
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

        {isLoading && !streamingMessage && !toolCallStatus && (
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

        {/* 工具调用状态 */}
        {toolCallStatus && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{toolCallStatus}</span>
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
      <div
        className="border-t border-gray-200/50 p-4 bg-white/50 chat-input"
        onClick={handleInputAreaClick}
      >
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
            className={`flex-1 resize-none rounded-xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 bg-white ${
              draggingText
                ? 'border-blue-400 ring-2 ring-blue-200'
                : 'border-gray-200 focus:ring-blue-500'
            }`}
            rows={2}
            disabled={isLoading}
            placeholder={draggingText ? '点击添加为引用...' : ''}
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
    </>
  );
}
