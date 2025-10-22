'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import { useTextSelection } from '@/hooks/useTextSelection';
import AddToButton from '../AddToButton';
import AIToolbar from '../AI/AIToolbar';
import PropertyPanel from '../PropertyPanel/PropertyPanel';
import type { CanvasNode } from '@/types';

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
}

export default function TextNode({ node, isSelected, onSelect, zoom }: TextNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(node.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAIToolbar, setShowAIToolbar] = useState(false);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const { updateNode, deleteNode, chatSessions } = useCanvasStore();

  // 检查是否有打开的聊天窗口
  const hasOpenChats = chatSessions.some(s => s.isOpen);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // 文本选中功能
  const { selectedText, selectionPosition, handleTextSelection, handleAddToClick } = useTextSelection();

  // 同步node.content到本地state
  useEffect(() => {
    setContent(node.content);
  }, [node.content]);

  // 自动聚焦编辑框
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // 保存内容
  const handleBlur = () => {
    setIsEditing(false);
    if (content !== node.content) {
      updateNode(node.id, { content });
    }
  };

  // 处理键盘事件（编辑模式）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setContent(node.content); // 恢复原内容
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
  };

  // 全局键盘事件监听（选中时）
  useEffect(() => {
    if (!isSelected || isEditing) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 检查焦点是否在可编辑元素上（input、textarea、contenteditable）
      const target = e.target as HTMLElement;
      const isEditableElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // 如果焦点在可编辑元素上，不处理全局快捷键
      if (isEditableElement) return;

      // Z 键切换属性面板
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowPropertyPanel(prev => !prev);
      }
      // Tab 键切换 AI 工具栏
      else if (e.key === 'Tab' && hasOpenChats) {
        e.preventDefault();
        setShowAIToolbar(prev => !prev);
      }
      // Delete 或 Backspace 键删除节点
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(node.id);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSelected, isEditing, node.id, deleteNode, hasOpenChats]);

  // 失去选中时隐藏 AI 工具栏和属性面板
  useEffect(() => {
    if (!isSelected) {
      setShowAIToolbar(false);
      setShowPropertyPanel(false);
    }
  }, [isSelected]);

  // 双击编辑
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  // 拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing) return;

    onSelect();
    setIsDragging(true);

    // 记录开始拖动时的鼠标位置和节点位置
    setDragOffset({
      x: e.clientX / zoom - node.position.x,
      y: e.clientY / zoom - node.position.y,
    });

    e.stopPropagation();
  };

  // 调整大小开始
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    onSelect();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: node.size.width,
      height: node.size.height || 150,
    });
  };

  // 拖拽中
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX / zoom - dragOffset.x;
      const newY = e.clientY / zoom - dragOffset.y;

      updateNode(node.id, {
        position: { x: newX, y: newY },
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, zoom, node.id, updateNode]);

  // 调整大小中
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - resizeStart.x) / zoom;
      const deltaY = (e.clientY - resizeStart.y) / zoom;

      const newWidth = Math.max(100, resizeStart.width + deltaX);
      const newHeight = Math.max(60, resizeStart.height + deltaY);

      updateNode(node.id, {
        size: { width: newWidth, height: newHeight },
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, zoom, node.id, updateNode]);

  // AI 生成的节点有特殊样式
  const isAIGenerated = node.type === 'ai-generated';

  // 获取当前样式
  const currentStyle = node.style || {};
  const backgroundColor = currentStyle.backgroundColor || 'transparent';
  const textStyle = {
    fontSize: currentStyle.fontSize ? `${currentStyle.fontSize}px` : '14px',
    fontWeight: currentStyle.fontWeight || 'normal',
    color: currentStyle.textColor || '#1F2937',
  };

  return (
    <div
      ref={nodeRef}
      className={`
        absolute select-none
        ${isSelected ? 'ring-2 ring-blue-400/50' : ''}
        ${isDragging ? 'opacity-60 cursor-move' : 'cursor-move'}
        ${isResizing ? 'cursor-nwse-resize' : ''}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        height: node.size.height,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`
          h-full p-4
          ${isAIGenerated ? 'bg-gradient-to-br from-purple-50/50 to-pink-50/50 border border-purple-200/50 rounded-2xl backdrop-blur-sm' : 'rounded-lg'}
          transition-all
        `}
        style={{
          backgroundColor: backgroundColor !== 'transparent' ? backgroundColor : undefined,
        }}
      >
        {/* AI 标记 */}
        {isAIGenerated && (
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>AI</span>
          </div>
        )}

        {/* 内容 */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onMouseUp={handleTextSelection}
            className="w-full h-full resize-none border-none outline-none font-sans bg-transparent leading-relaxed"
            placeholder="输入内容... (Ctrl+Enter 保存, Esc 取消)"
            style={textStyle}
          />
        ) : (
          <div
            className="whitespace-pre-wrap break-words h-full leading-relaxed overflow-hidden"
            style={textStyle}
          >
            {node.content || <span className="text-gray-400">双击编辑...</span>}
          </div>
        )}

        {/* 右侧按钮组 */}
        {isSelected && !isEditing && (
          <div className="absolute -right-[62px] top-1/2 -translate-y-1/2 flex flex-col gap-2 items-start z-10">
            {/* 快捷键提示 */}
            {!showPropertyPanel && !showAIToolbar && (
              <>
                <div className="bg-gray-800/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 shadow-lg">
                  <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">Z</kbd>
                  <span>属性</span>
                </div>
                {hasOpenChats && (
                  <div className="bg-gray-800/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 shadow-lg">
                    <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">Tab</kbd>
                    <span>AI</span>
                  </div>
                )}
              </>
            )}

            {/* AI 工具栏 */}
            {showAIToolbar && <AIToolbar node={node} />}
          </div>
        )}

        {/* 属性面板 */}
        {isSelected && !isEditing && showPropertyPanel && (
          <div className="absolute -right-[220px] top-1/2 -translate-y-1/2 z-10">
            <PropertyPanel node={node} showBackgroundColor={false} />
          </div>
        )}

        {/* 调整大小手柄 */}
        {isSelected && !isEditing && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-400/50 rounded-full cursor-nwse-resize hover:bg-blue-500/70 transition-colors z-0"
            onMouseDown={handleResizeStart}
          />
        )}
      </div>

      {/* Add to 按钮 */}
      {selectedText && selectionPosition && (
        <AddToButton
          selectedText={selectedText}
          position={selectionPosition}
          onClick={handleAddToClick}
        />
      )}
    </div>
  );
}
