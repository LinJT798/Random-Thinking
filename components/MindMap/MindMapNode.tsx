'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import PropertyPanel from '../PropertyPanel/PropertyPanel';
import type { CanvasNode } from '@/types';

interface MindMapNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
}

export default function MindMapNode({ node, isSelected, onSelect, zoom }: MindMapNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(node.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);

  const { updateNode, deleteNode, addChildNode } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const level = node.mindMapMetadata?.level || 0;

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
    // Enter - 添加同级节点
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
      // TODO: 添加同级节点逻辑
    }
    // Tab - 添加子节点
    else if (e.key === 'Tab') {
      e.preventDefault();
      handleBlur();
      addChildNode(node.id, '');
    }
  };

  // 选中状态变化时隐藏属性面板
  useEffect(() => {
    if (!isSelected) {
      setShowPropertyPanel(false);
    }
  }, [isSelected]);

  // 全局键盘事件监听（选中时）
  useEffect(() => {
    if (!isSelected || isEditing) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Shift 键切换属性面板
      if (e.key === 'Shift') {
        e.preventDefault();
        setShowPropertyPanel(prev => !prev);
      }
      // Enter - 开始编辑
      else if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(true);
      }
      // Tab - 添加子节点
      else if (e.key === 'Tab') {
        e.preventDefault();
        addChildNode(node.id, '新节点');
      }
      // Delete 或 Backspace 键删除节点
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(node.id);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSelected, isEditing, node.id, deleteNode, addChildNode]);

  // 双击编辑
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  // 拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;

    onSelect();
    setIsDragging(true);

    setDragOffset({
      x: e.clientX / zoom - node.position.x,
      y: e.clientY / zoom - node.position.y,
    });

    e.stopPropagation();
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

  // 获取当前样式
  const currentStyle = node.style || {};
  const backgroundColor = currentStyle.backgroundColor || 'transparent';

  // 根据层级设置样式
  const getLevelStyle = () => {
    const baseSize = currentStyle.fontSize || Math.max(12, 16 - level * 2);
    const padding = Math.max(8, 16 - level * 2);

    return {
      fontSize: `${baseSize}px`,
      padding: `${padding}px ${padding * 1.5}px`,
      fontWeight: currentStyle.fontWeight || 'normal',
      color: currentStyle.textColor || '#1F2937',
    };
  };

  return (
    <div
      ref={nodeRef}
      className={`
        absolute select-none
        ${isSelected ? 'ring-2 ring-indigo-400/50' : ''}
        ${isDragging ? 'opacity-60 cursor-move' : 'cursor-move'}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        minWidth: 150,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`
          backdrop-blur-sm border-2 rounded-lg shadow-md
          hover:shadow-lg transition-all
          ${level === 0 ? 'border-indigo-500 font-semibold' : `border-indigo-${Math.max(200, 400 - level * 100)}`}
        `}
        style={{
          ...getLevelStyle(),
          backgroundColor: backgroundColor !== 'transparent' ? backgroundColor : 'rgba(255, 255, 255, 0.9)',
        }}
      >
        {/* 内容 */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full resize-none border-none outline-none bg-transparent"
              placeholder="输入内容..."
              rows={1}
            />
          ) : (
            <div className="w-full whitespace-pre-wrap break-words">
              {node.content || <span className="text-gray-400">双击编辑...</span>}
            </div>
          )}
        </div>
      </div>

      {/* 属性面板和快捷键提示 */}
      {isSelected && !isEditing && (
        <div className="absolute -right-[100px] top-2 flex flex-col gap-2 items-end z-10">
          {/* 属性面板 */}
          {showPropertyPanel && <PropertyPanel node={node} />}

          {/* 快捷键提示 */}
          {!showPropertyPanel && (
            <div className="bg-gray-800/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 shadow-lg">
              <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">Shift</kbd>
              <span>属性</span>
            </div>
          )}
        </div>
      )}

      {/* 层级指示器 */}
      {level > 0 && (
        <div
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-indigo-400"
          style={{ opacity: Math.max(0.3, 1 - level * 0.15) }}
        />
      )}
    </div>
  );
}
