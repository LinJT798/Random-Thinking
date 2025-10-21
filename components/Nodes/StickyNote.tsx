'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import AIToolbar from '../AI/AIToolbar';
import PropertyPanel from '../PropertyPanel/PropertyPanel';
import type { CanvasNode } from '@/types';

interface StickyNoteProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
}

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100/90', border: 'border-yellow-200/50' },
  { name: 'pink', bg: 'bg-pink-100/90', border: 'border-pink-200/50' },
  { name: 'blue', bg: 'bg-blue-100/90', border: 'border-blue-200/50' },
  { name: 'green', bg: 'bg-green-100/90', border: 'border-green-200/50' },
  { name: 'purple', bg: 'bg-purple-100/90', border: 'border-purple-200/50' },
];

export default function StickyNote({ node, isSelected, onSelect, zoom }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(node.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAIToolbar, setShowAIToolbar] = useState(false);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const { updateNode, deleteNode, addNode } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // 获取当前颜色
  const currentColor = COLORS.find(c => c.name === node.color) || COLORS[0];

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
      setContent(node.content);
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
      else if (e.key === 'Tab') {
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
  }, [isSelected, isEditing, node.id, deleteNode]);

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
      width: node.size.width || 200,
      height: node.size.height || 200,
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

      const newWidth = Math.max(80, resizeStart.width + deltaX);
      const newHeight = Math.max(80, resizeStart.height + deltaY);

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

  // 添加新节点
  const handleAddNewNode = async () => {
    const newX = node.position.x + (node.size.width || 200) + 50; // 在右侧50px处
    const newY = node.position.y;

    await addNode({
      type: 'sticky',
      content: '',
      position: { x: newX, y: newY },
      size: { width: 200, height: 200 },
      connections: [],
      color: node.color, // 使用相同颜色
    });
  };

  // 获取当前样式
  const currentStyle = node.style || {};
  const textStyle = {
    fontSize: currentStyle.fontSize ? `${currentStyle.fontSize}px` : '14px',
    fontWeight: currentStyle.fontWeight || 'normal',
    color: currentStyle.textColor || '#000000',
  };

  return (
    <div
      ref={nodeRef}
      className={`
        absolute select-none p-4
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
        ${isDragging ? 'opacity-70 cursor-move' : 'cursor-move'}
        ${isResizing ? 'cursor-nwse-resize' : ''}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width || 200,
        height: node.size.height || 200,
        backgroundImage: 'url(/stickynote.png)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* 内容 */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none border-none outline-none bg-transparent font-handwriting"
          placeholder="写下你的想法..."
          style={textStyle}
        />
      ) : (
        <div className="whitespace-pre-wrap break-words h-full font-handwriting" style={textStyle}>
          {node.content || '双击编辑...'}
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
              <div className="bg-gray-800/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 shadow-lg">
                <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">Tab</kbd>
                <span>AI</span>
              </div>
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
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-400/50 rounded-full cursor-nwse-resize hover:bg-blue-500/70 transition-colors z-10"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}
