'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import { useTextSelection } from '@/hooks/useTextSelection';
import AddToButton from '../AddToButton';
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
      setContent(node.content);
    }
    // Enter - 添加同级节点
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
      // TODO: 添加同级节点逻辑
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
      // Enter - 开始编辑
      else if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(true);
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
          ${level === 0 ? 'border-sky-400 font-semibold' : level === 1 ? 'border-sky-300' : 'border-sky-200'}
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
              onMouseUp={handleTextSelection}
              className="w-full resize-none border-none outline-none bg-transparent"
              placeholder="输入内容..."
              rows={1}
            />
          ) : (
            <div
              className="w-full whitespace-pre-wrap break-words"
            >
              {node.content || <span className="text-gray-400">双击编辑...</span>}
            </div>
          )}
        </div>
      </div>

      {/* 右侧按钮组 */}
      {isSelected && !isEditing && (
        <div className="absolute -right-[62px] top-1/2 -translate-y-1/2 flex flex-col gap-2 items-start z-10">
          {/* Z键提示 - 属性按钮 */}
          {!showPropertyPanel && (
            <div className="bg-gray-800/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 shadow-lg">
              <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">Z</kbd>
              <span>属性</span>
            </div>
          )}

          {/* 加号按钮 - 添加子节点 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addChildNode(node.id, '新节点');
            }}
            className="w-6 h-6 bg-sky-400 hover:bg-sky-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
            title="添加子节点"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* 属性面板 */}
      {isSelected && !isEditing && showPropertyPanel && (
        <div className="absolute -right-[170px] top-1/2 -translate-y-1/2 z-10">
          <PropertyPanel node={node} />
        </div>
      )}

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
