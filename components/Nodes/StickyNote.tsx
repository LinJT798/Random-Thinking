'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import AIToolbar from '../AI/AIToolbar';
import type { CanvasNode } from '@/types';

interface StickyNoteProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
}

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-200', border: 'border-yellow-300' },
  { name: 'pink', bg: 'bg-pink-200', border: 'border-pink-300' },
  { name: 'blue', bg: 'bg-blue-200', border: 'border-blue-300' },
  { name: 'green', bg: 'bg-green-200', border: 'border-green-300' },
  { name: 'purple', bg: 'bg-purple-200', border: 'border-purple-300' },
];

export default function StickyNote({ node, isSelected, onSelect, zoom }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(node.content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { updateNode, deleteNode } = useCanvasStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // 获取当前颜色
  const currentColor = COLORS.find(c => c.name === node.color) || COLORS[0];

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
      setContent(node.content);
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

  // 改变颜色
  const changeColor = (colorName: string) => {
    updateNode(node.id, { color: colorName });
  };

  // 删除节点
  const handleDelete = () => {
    if (confirm('确定要删除这个便签吗？')) {
      deleteNode(node.id);
    }
  };

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
        width: node.size.width || 200,
        minHeight: node.size.height || 200,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`
          ${currentColor.bg} ${currentColor.border}
          rounded-lg shadow-lg p-4 border-2
          hover:shadow-xl transition-shadow
          h-full
        `}
        style={{
          boxShadow: '4px 4px 8px rgba(0,0,0,0.1)',
        }}
      >
        {/* 内容 */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`w-full h-full resize-none border-none outline-none ${currentColor.bg} font-handwriting`}
            placeholder="写下你的想法..."
            style={{ background: 'transparent' }}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words h-full font-handwriting">
            {node.content || '双击编辑...'}
          </div>
        )}

        {/* 工具栏（仅在选中时显示） */}
        {isSelected && !isEditing && (
          <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-2">
            {/* AI 工具栏 */}
            <AIToolbar node={node} />

            {/* 颜色选择 */}
            <div className="bg-white rounded shadow-lg p-2 flex gap-2">
              {COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => changeColor(color.name)}
                  className={`w-6 h-6 rounded-full ${color.bg} ${color.border} border-2 hover:scale-110 transition-transform`}
                  title={color.name}
                />
              ))}
            </div>

            {/* 删除按钮 */}
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
