'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import AIToolbar from '../AI/AIToolbar';
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

  const { updateNode, deleteNode } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

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

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setContent(node.content); // 恢复原内容
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
  };

  // 双击编辑
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  // 拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;

    onSelect();
    setIsDragging(true);

    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      });
    }

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

  // 删除节点
  const handleDelete = () => {
    if (confirm('确定要删除这个节点吗？')) {
      deleteNode(node.id);
    }
  };

  // AI 生成的节点有特殊样式
  const isAIGenerated = node.type === 'ai-generated';

  return (
    <div
      ref={nodeRef}
      className={`
        absolute cursor-move select-none
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
        ${isDragging ? 'opacity-70' : ''}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        minHeight: node.size.height,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`
          bg-white rounded-lg shadow-lg p-4
          ${isAIGenerated ? 'border-2 border-purple-300' : 'border border-gray-200'}
          hover:shadow-xl transition-shadow
        `}
      >
        {/* AI 标记 */}
        {isAIGenerated && (
          <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
            AI
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
            className="w-full min-h-[100px] resize-none border-none outline-none font-sans"
            placeholder="输入内容... (Ctrl+Enter 保存, Esc 取消)"
          />
        ) : (
          <div className="whitespace-pre-wrap break-words min-h-[100px]">
            {node.content || '双击编辑...'}
          </div>
        )}

        {/* 工具栏（仅在选中时显示） */}
        {isSelected && !isEditing && (
          <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-2">
            <AIToolbar node={node} />
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
