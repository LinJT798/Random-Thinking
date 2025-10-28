'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import { useTextSelection } from '@/hooks/useTextSelection';
import AddToButton from '../AddToButton';
import { detectNodeChanges } from '@/lib/context-builder';
import { calculateTextNodeSize } from '@/lib/text-size-calculator';
import { createMindMapNetwork } from '@/lib/mindmap-creator';
import { findNonOverlappingPosition } from '@/lib/smart-layout';
import type { ToolCallInfo } from '@/types';

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
    confirmToolCall,
    rejectToolCall,
    dockedChatId,
    dockedWidth,
    toggleDockedChat,
  } = useCanvasStore();

  // Get the specific chat session
  const session = chatSessions.find(s => s.id === chatId);

  // 判断当前窗口是否处于分屏模式
  const isDocked = dockedChatId === chatId;

  // 自动滚焦到标题输入框
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // 自动滚动到最新消息（防止页面滚动）
  useEffect(() => {
    if (session) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [session, session?.messages, streamingMessage]);

  // 处理工具调用
  const handleToolCall = async (toolName: string, input: Record<string, unknown>): Promise<string[]> => {
    const toolLabels: Record<string, string> = {
      'add_text_node': '正在创建文本框...',
      'add_sticky_note': '正在创建便签...',
      'create_mindmap': '正在创建思维导图...'
    };

    setToolCallStatus(toolLabels[toolName] || '正在执行操作...');

    const createdNodeIds: string[] = [];

    try {
      // 获取最新的 nodes 状态（确保看到刚刚创建的节点）
      const currentNodes = useCanvasStore.getState().nodes;

      switch (toolName) {
        case 'add_text_node': {
          const size = calculateTextNodeSize(input.content as string);

          const position = (input.position as { x: number; y: number } | undefined) || findNonOverlappingPosition({
            width: size.width,
            height: size.height,
            nodes: currentNodes
          });

          const nodeId = await addNode({
            type: 'text',
            content: input.content as string,
            position,
            size,
            connections: [],
          });
          createdNodeIds.push(nodeId);
          break;
        }

        case 'add_sticky_note': {
          const position = findNonOverlappingPosition({
            width: 200,
            height: 200,
            nodes: currentNodes
          });

          const nodeId = await addNode({
            type: 'sticky',
            content: input.content as string,
            position,
            size: { width: 200, height: 200 },
            color: 'yellow', // 固定使用淡黄色
            connections: [],
          });
          createdNodeIds.push(nodeId);
          break;
        }

        case 'create_mindmap': {
          // 思维导图会展开，预留超大空间
          const position = findNonOverlappingPosition({
            width: 2000,
            height: 1200,
            nodes: currentNodes
          });

          // 记录创建前的节点ID
          const nodesBefore = useCanvasStore.getState().nodes.map(n => n.id);

          await createMindMapNetwork(
            input.root as string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (input.children as any[] | undefined) || [],
            {
              addNode,
              startPosition: position,
              getAllNodes: () => useCanvasStore.getState().nodes
            }
          );

          // 找出新创建的节点ID
          const nodesAfter = useCanvasStore.getState().nodes;
          const newNodeIds = nodesAfter
            .filter(n => !nodesBefore.includes(n.id))
            .map(n => n.id);
          createdNodeIds.push(...newNodeIds);
          break;
        }
      }

      setTimeout(() => setToolCallStatus(''), 1000);
    } catch (error) {
      console.error('Tool call failed:', error);
      setToolCallStatus('');
    }

    return createdNodeIds;
  };

  // 处理 API 调用并处理流式响应
  const callAIAndProcessStream = async (requestBody: Record<string, unknown>) => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
    const toolCallsList: ToolCallInfo[] = [];

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
                const nodeIds = await handleToolCall(parsed.tool, parsed.input);

                // 记录工具调用信息（包含 tool_use_id 和 input）
                toolCallsList.push({
                  tool_use_id: parsed.tool_use_id,
                  tool: parsed.tool,
                  input: parsed.input, // 保存输入参数
                  nodeIds,
                  status: 'pending'
                });

                // 添加工具调用反馈到消息中
                const toolNames: Record<string, string> = {
                  'add_text_node': '已创建文本框',
                  'add_sticky_note': '已创建便签',
                  'create_mindmap': '已创建思维导图'
                };
                fullMessage += `✨ ${toolNames[parsed.tool] || '已执行操作'}`;
                setStreamingMessage(fullMessage);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    }

    return { fullMessage, toolCallsList };
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

      // 第一轮：发送用户消息
      const { fullMessage: firstMessage, toolCallsList } = await callAIAndProcessStream({
        userMessage: apiMessage,
        initialNodes: nodes,
        nodeChanges,
        chatHistory: currentChatMessages.slice(0, -1),
      });

      // 如果有工具调用，进行第二轮对话
      if (toolCallsList.length > 0) {
        // 保存第一轮的 AI 回复（包含工具调用）
        await addChatMessage(
          chatId,
          'assistant',
          firstMessage || '',
          undefined,
          toolCallsList
        );

        // 保存 tool 消息到数据库（保持对话格式正确）
        for (const toolCall of toolCallsList) {
          const toolNames: Record<string, string> = {
            'add_text_node': '文本框',
            'add_sticky_note': '便签',
            'create_mindmap': '思维导图'
          };

          await addChatMessage(
            chatId,
            'tool',
            `成功创建${toolNames[toolCall.tool] || '节点'}（${toolCall.nodeIds.length} 个节点）`,
            undefined,
            undefined,
            toolCall.tool_use_id
          );
        }

        // 清空流式消息显示
        setStreamingMessage('');

        // 第二轮：请求 AI 总结工具执行结果
        // 此时对话历史格式正确：user → assistant (tool_calls) → tool
        const updatedSession = useCanvasStore.getState().chatSessions.find(s => s.id === chatId);
        const updatedChatMessages = updatedSession?.messages || [];

        // 触发 AI 继续对话，它会看到完整的工具执行历史
        // 不传 userMessage，让 AI 基于 tool 消息自动生成总结
        const { fullMessage: secondMessage } = await callAIAndProcessStream({
          initialNodes: nodes,
          nodeChanges: null,
          chatHistory: updatedChatMessages,
        });

        // 保存第二轮的 AI 回复（AI 对工具执行的总结）
        if (secondMessage && secondMessage.trim()) {
          await addChatMessage(
            chatId,
            'assistant',
            secondMessage,
            undefined,
            undefined
          );
        }
      } else {
        // 没有工具调用，直接保存消息
        await addChatMessage(
          chatId,
          'assistant',
          firstMessage || '',
          undefined,
          undefined
        );
      }

      setStreamingMessage('');
      // 清空引用
      clearChatReferences(chatId);
    } catch (error) {
      console.error('Error sending message:', error);
      // 可以添加错误提示
    } finally {
      setIsLoading(false);
      inputRef.current?.focus({ preventScroll: true });
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

      // 聚焦输入框（防止页面滚动）
      inputRef.current?.focus({ preventScroll: true });
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
        className={`fixed backdrop-blur-xl flex flex-col overflow-hidden ${
          // 只在非拖动/调整大小状态下才应用过渡动画
          !isDragging && !isResizing ? 'transition-all duration-300' : ''
        } ${
          isDocked
            ? 'rounded-none'
            : 'rounded-2xl'
        }`}
        style={
          isDocked
            ? {
                // 分屏模式：固定在左侧
                left: 0,
                top: 0,
                width: `${dockedWidth}vw`,
                height: '100vh',
                zIndex: 1000,
                background: 'rgba(237, 228, 213, 0.9)',
                boxShadow: '0 8px 24px rgba(61, 52, 44, 0.12)',
                border: '1px solid rgba(122, 111, 103, 0.2)',
              }
            : {
                // 浮动模式：正常位置
                left: `${session.position.x}px`,
                top: `${session.position.y}px`,
                width: `${session.size.width}px`,
                height: `${session.size.height}px`,
                cursor: isDragging ? 'grabbing' : 'default',
                zIndex: 1000,
                background: 'rgba(237, 228, 213, 0.9)',
                boxShadow: '0 8px 24px rgba(61, 52, 44, 0.12)',
                border: '1px solid rgba(122, 111, 103, 0.2)',
              }
        }
        onWheel={(e) => e.stopPropagation()}
      >
      {/* 标题栏 - 纸感风格 */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          isDocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{
          borderBottom: '1px solid rgba(122, 111, 103, 0.15)',
          background: 'rgba(248, 244, 239, 0.5)',
        }}
        onMouseDown={isDocked ? undefined : handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#8B8E63' }}></div>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              className="flex-1 font-semibold rounded px-2 py-0.5 text-sm focus:outline-none"
              style={{
                color: '#3D342C',
                background: 'rgba(248, 244, 239, 0.8)',
                border: '1px solid rgba(139, 142, 99, 0.4)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '1px solid rgba(139, 142, 99, 0.6)';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
                handleSaveTitle(e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="font-semibold cursor-pointer transition-colors truncate"
              style={{ color: '#3D342C' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#8B8E63'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#3D342C'}
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
          {/* 固定/取消固定按钮 - 橄榄绿配色 */}
          <button
            onClick={() => toggleDockedChat(chatId)}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: isDocked ? 'rgba(139, 142, 99, 0.15)' : 'transparent',
              color: isDocked ? '#8B8E63' : '#7A6F67',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDocked ? 'rgba(139, 142, 99, 0.25)' : 'rgba(122, 111, 103, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDocked ? 'rgba(139, 142, 99, 0.15)' : 'transparent';
            }}
            title={isDocked ? '取消固定' : '固定到左侧'}
          >
            {isDocked ? (
              // 取消固定图标
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              // 固定图标
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </button>
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

        {session.messages.filter(msg => msg.role !== 'tool').map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* 引用内容（仅用户消息）- 纸感风格 */}
              {msg.role === 'user' && msg.references && msg.references.length > 0 && (
                <div className="mb-1 space-y-1">
                  {msg.references.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
                      style={{
                        background: 'rgba(122, 111, 103, 0.15)',
                        color: '#7A6F67',
                      }}
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

              {/* 如果有工具调用，显示特殊卡片；否则显示普通消息气泡 */}
              {msg.role === 'assistant' && msg.toolCalls ? (
                // 工具调用特殊卡片
                <div className="w-full space-y-2">
                  {/* 如果有文字内容，先显示文字气泡 */}
                  {msg.content && msg.content.trim() && !msg.content.includes('✨') && (
                    <div
                      className="rounded-2xl px-4 py-2 bg-gray-100 text-gray-900 select-text cursor-text"
                      onMouseUp={(e) => handleTextSelection(e)}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                    </div>
                  )}

                  {/* 工具调用卡片 */}
                  {msg.toolCalls.map((toolCall, index) => {
                    // 工具类型映射
                    const toolInfo: Record<string, { icon: string; name: string; description: string }> = {
                      'add_text_node': { icon: '📝', name: '文本框', description: '创建了文本框' },
                      'add_sticky_note': { icon: '📌', name: '便签', description: '创建了便签' },
                      'create_mindmap': { icon: '🧠', name: '思维导图', description: '创建了思维导图' }
                    };

                    const info = toolInfo[toolCall.tool] || { icon: '✨', name: '节点', description: '执行了操作' };
                    const nodeCount = toolCall.nodeIds.length;

                    return (
                      <div
                        key={index}
                        className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                        style={{
                          background: 'linear-gradient(135deg, rgba(198, 200, 170, 0.2) 0%, rgba(139, 142, 99, 0.15) 100%)',
                          border: '1px solid rgba(139, 142, 99, 0.3)',
                          boxShadow: '0 4px 12px rgba(61, 52, 44, 0.08)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 20px rgba(61, 52, 44, 0.12)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(61, 52, 44, 0.08)'}
                      >
                        {/* 标题栏 - 橄榄绿渐变 */}
                        <div className="px-4 py-2" style={{
                          background: 'linear-gradient(90deg, rgba(139, 142, 99, 0.9) 0%, rgba(198, 200, 170, 0.8) 100%)',
                        }}>
                          <div className="flex items-center gap-2 text-white">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-semibold">AI 操作</span>
                          </div>
                        </div>

                        {/* 内容区 */}
                        <div className="px-4 py-3 space-y-3">
                          {/* 操作详情 */}
                          <div className="flex items-start gap-3">
                            <div className="text-3xl leading-none">{info.icon}</div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold" style={{ color: '#3D342C' }}>{info.description}</div>
                              {nodeCount > 1 && (
                                <div className="text-xs mt-1" style={{ color: '#7A6F67' }}>
                                  包含 <span className="font-semibold" style={{ color: '#8B8E63' }}>{nodeCount}</span> 个节点
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-2 pt-2" style={{
                            borderTop: '1px solid rgba(139, 142, 99, 0.15)',
                          }}>
                            {toolCall.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => confirmToolCall(chatId, msg.id, index)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200"
                                  style={{
                                    background: 'rgba(248, 244, 239, 0.8)',
                                    border: '2px solid rgba(139, 142, 99, 0.5)',
                                    color: '#8B8E63',
                                    boxShadow: '0 2px 4px rgba(61, 52, 44, 0.05)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(139, 142, 99, 0.15)';
                                    e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.7)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(61, 52, 44, 0.08)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(248, 244, 239, 0.8)';
                                    e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.5)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(61, 52, 44, 0.05)';
                                  }}
                                  title="确认保留"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>保留</span>
                                </button>
                                <button
                                  onClick={() => rejectToolCall(chatId, msg.id, index)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200"
                                  style={{
                                    background: 'rgba(248, 244, 239, 0.8)',
                                    border: '2px solid rgba(122, 111, 103, 0.3)',
                                    color: '#7A6F67',
                                    boxShadow: '0 2px 4px rgba(61, 52, 44, 0.05)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.5)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(61, 52, 44, 0.08)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(248, 244, 239, 0.8)';
                                    e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.3)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(61, 52, 44, 0.05)';
                                  }}
                                  title="删除节点"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>删除</span>
                                </button>
                              </>
                            )}
                            {toolCall.status === 'confirmed' && (
                              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl w-full" style={{
                                color: '#8B8E63',
                                background: 'rgba(139, 142, 99, 0.15)',
                              }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm font-semibold">已保留</span>
                              </div>
                            )}
                            {toolCall.status === 'rejected' && (
                              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl w-full" style={{
                                color: '#7A6F67',
                                background: 'rgba(122, 111, 103, 0.1)',
                              }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-sm font-semibold">已删除</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // 普通消息气泡
                <>
                  <div
                    className="rounded-2xl px-4 py-2 relative select-text cursor-text"
                    style={{
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, rgba(139, 142, 99, 0.9) 0%, rgba(198, 200, 170, 0.85) 100%)'
                        : 'rgba(248, 244, 239, 0.6)',
                      color: msg.role === 'user' ? '#fff' : '#3D342C',
                      border: msg.role === 'user' ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.15)',
                    }}
                    onMouseUp={(e) => msg.role === 'assistant' && handleTextSelection(e)}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                  </div>

                  {/* AI 消息的添加到画布按钮 */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleAddToCanvas(msg.content)}
                      className="mt-1 text-xs transition-colors flex items-center gap-1"
                      style={{ color: '#7A6F67' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#8B8E63'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#7A6F67'}
                      title="添加到画布"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>添加到画布</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && !streamingMessage && !toolCallStatus && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2" style={{
              background: 'rgba(248, 244, 239, 0.6)',
              border: '1px solid rgba(122, 111, 103, 0.15)',
              color: '#3D342C',
            }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: '#7A6F67' }}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#7A6F67' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#7A6F67', animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#7A6F67', animationDelay: '0.2s' }}></div>
                </div>
                <span>正在思考</span>
              </div>
            </div>
          </div>
        )}

        {/* 工具调用状态 - 橄榄绿配色 */}
        {toolCallStatus && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2" style={{
              background: 'linear-gradient(135deg, rgba(198, 200, 170, 0.2) 0%, rgba(139, 142, 99, 0.15) 100%)',
              border: '1px solid rgba(139, 142, 99, 0.3)',
            }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8E63' }}>
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

      {/* 输入区域 - 纸感风格 */}
      <div
        className="p-4 chat-input"
        style={{
          borderTop: '1px solid rgba(122, 111, 103, 0.15)',
          background: 'rgba(248, 244, 239, 0.5)',
        }}
        onClick={handleInputAreaClick}
      >
        {/* 引用内容显示 */}
        {session.references.length > 0 && (
          <div className="mb-3 space-y-2">
            {session.references.map((ref) => (
              <div
                key={ref.id}
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'rgba(122, 111, 103, 0.1)',
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-60" style={{ color: '#7A6F67' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <div className="flex-1 line-clamp-2" style={{ color: '#7A6F67' }}>
                  {ref.content}
                </div>
                <button
                  onClick={() => removeChatReference(chatId, ref.id)}
                  className="flex-shrink-0 transition-colors"
                  style={{ color: '#7A6F67' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3D342C'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#7A6F67'}
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
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{
              background: 'rgba(248, 244, 239, 0.8)',
              border: draggingText ? '1px solid rgba(139, 142, 99, 0.6)' : '1px solid rgba(122, 111, 103, 0.2)',
              color: '#3D342C',
              ...(draggingText && {
                boxShadow: '0 0 0 2px rgba(139, 142, 99, 0.2)',
              }),
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.4)';
              e.currentTarget.style.outline = '1px solid rgba(139, 142, 99, 0.3)';
              e.currentTarget.style.outlineOffset = '0';
            }}
            onBlur={(e) => {
              if (!draggingText) {
                e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.2)';
                e.currentTarget.style.outline = 'none';
              }
            }}
            rows={2}
            disabled={isLoading}
            placeholder={draggingText ? '点击添加为引用...' : ''}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim()) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 1) 0%, rgba(196, 129, 76, 0.95) 100%)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)';
            }}
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

      {/* 调整大小手柄 - 分屏模式下隐藏 */}
      {!isDocked && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-4 h-4 absolute bottom-1 right-1 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14 14V8h-1v5H8v1h5a1 1 0 001-1z"/>
            <path d="M8 10V5H7v4H3v1h4a1 1 0 001-1z"/>
          </svg>
        </div>
      )}

      </div>
    </>
  );
}
