'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import { sanitizeHTML } from '@/lib/html-sanitizer';
import TextToolbar from './TextToolbar';
import PropertyPanel from '../PropertyPanel/PropertyPanel';
import AIConfirmToolbar from './AIConfirmToolbar';
import type { CanvasNode } from '@/types';

interface StickyNoteProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
  viewportOffset: { x: number; y: number };
}

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100/90', border: 'border-yellow-200/50' },
  { name: 'pink', bg: 'bg-pink-100/90', border: 'border-pink-200/50' },
  { name: 'blue', bg: 'bg-blue-100/90', border: 'border-blue-200/50' },
  { name: 'green', bg: 'bg-green-100/90', border: 'border-green-200/50' },
  { name: 'purple', bg: 'bg-purple-100/90', border: 'border-purple-200/50' },
];

export default function StickyNote({ node, isSelected, onSelect, zoom, viewportOffset }: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const { updateNode, deleteNode, setDraggingText } = useCanvasStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // 文本选中状态（自定义管理）
  const [selectedText, setSelectedText] = useState('');
  const [selectionRelativePos, setSelectionRelativePos] = useState<{ x: number; y: number } | null>(null);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // 检测并更新选区
  const updateSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString() || '';

      if (text.length > 0 && selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        setSavedRange(range.cloneRange());

        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();

        const offsetScreenX = rect.left + rect.width / 2 - editorRect.left;
        const offsetScreenY = rect.top - editorRect.top;

        const relativeX = offsetScreenX / zoom;
        const relativeY = offsetScreenY / zoom;

        setSelectedText(text);
        setSelectionRelativePos({ x: relativeX, y: relativeY });
      }
    }, 10);
  };

  const clearSelection = () => {
    setSelectedText('');
    setSelectionRelativePos(null);
    setSavedRange(null);
  };

  const getToolbarScreenPosition = () => {
    if (!selectionRelativePos || !editorRef.current) return null;

    const editorRect = editorRef.current.getBoundingClientRect();
    const offsetScreenX = selectionRelativePos.x * zoom;
    const offsetScreenY = selectionRelativePos.y * zoom;

    const screenX = editorRect.left + offsetScreenX;
    const screenY = editorRect.top + offsetScreenY;

    return { x: screenX, y: screenY };
  };

  const restoreSelection = () => {
    if (savedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    }
  };

  // 初始化内容
  useEffect(() => {
    if (editorRef.current && !isEditing) {
      const displayContent = node.content || '<span style="color: #9CA3AF">双击编辑...</span>';
      editorRef.current.innerHTML = displayContent;
    }
  }, [node.content, isEditing]);

  // 进入编辑模式时的初始化
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.innerHTML = node.content;
      editorRef.current.focus();

      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  // 保存内容
  const handleBlur = () => {
    setIsEditing(false);
    clearSelection();

    const htmlContent = editorRef.current?.innerHTML || '';
    const cleanedHTML = sanitizeHTML(htmlContent);

    if (cleanedHTML !== node.content) {
      updateNode(node.id, { content: cleanedHTML });
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = cleanedHTML;
    }
  };

  // 格式化功能
  const applyBold = () => {
    restoreSelection();
    document.execCommand('bold', false);
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyItalic = () => {
    restoreSelection();
    document.execCommand('italic', false);
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyUnderline = () => {
    restoreSelection();
    document.execCommand('underline', false);
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyStrikethrough = () => {
    restoreSelection();
    document.execCommand('strikeThrough', false);
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyFontSize = (size: number) => {
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedContent = range.extractContents();

    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    span.appendChild(selectedContent);

    range.insertNode(span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editorRef.current?.focus();

    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        setSavedRange(sel.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyColor = (color: string) => {
    restoreSelection();
    document.execCommand('foreColor', false, color);
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const applyBackgroundColor = (color: string) => {
    restoreSelection();
    if (color === 'transparent') {
      document.execCommand('removeFormat', false);
    } else {
      document.execCommand('backColor', false, color);
    }
    editorRef.current?.focus();
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        setSavedRange(selection.getRangeAt(0).cloneRange());
      }
    }, 0);
  };

  const handleAddTo = () => {
    if (selectedText) {
      setDraggingText(selectedText);
      clearSelection();
      window.getSelection()?.removeAllRanges();
    }
  };

  // 监听点击清除选区
  useEffect(() => {
    if (!isEditing || !selectedText) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-text-toolbar]')) {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, selectedText]);

  // 处理键盘事件（编辑模式）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editorRef.current) {
        editorRef.current.innerHTML = node.content;
      }
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
    else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyBold();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyItalic();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      applyUnderline();
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
      // Delete 或 Backspace 键删除节点
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNode(node.id);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSelected, isEditing, node.id, deleteNode]);

  // 失去选中时隐藏属性面板
  useEffect(() => {
    if (!isSelected) {
      setShowPropertyPanel(false);
    }
  }, [isSelected]);

  // 单击处理：已选中时进入编辑模式
  const handleClick = (e: React.MouseEvent) => {
    if (isEditing || isResizing) return;

    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (isSelected) {
      setIsEditing(true);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();

          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }, 0);
    }
  };

  // 拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing) return;

    if (!isSelected) {
      onSelect();
      justSelectedRef.current = true;
    }

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 5 && !isDragging) {
        setIsDragging(true);
        setDragOffset({
          x: startX / zoom - node.position.x,
          y: startY / zoom - node.position.y,
        });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

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

    // 拖拽时清除工具栏
    clearSelection();

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

  // 获取当前样式
  const currentStyle = node.style || {};
  const textStyle = {
    fontSize: currentStyle.fontSize ? `${currentStyle.fontSize}px` : '14px',
    fontWeight: currentStyle.fontWeight || 'normal',
    color: currentStyle.textColor || '#3D342C', // 深咖色
  };

  return (
    <div
      ref={nodeRef}
      className={`
        absolute p-1.5
        ${isEditing ? 'cursor-default' : 'select-none'}
        ${isEditing ? 'cursor-default' : isDragging ? 'opacity-70 cursor-move' : 'cursor-move'}
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
        ...(isSelected && {
          boxShadow: '0 0 0 2px rgba(139, 142, 99, 0.5)',
        }),
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* 内容 */}
      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseUp={isEditing ? updateSelection : undefined}
        onKeyUp={isEditing ? updateSelection : undefined}
        className={`w-full h-full border-none outline-none bg-transparent font-handwriting overflow-auto whitespace-pre-wrap break-words ${
          isEditing ? 'cursor-text' : 'overflow-hidden cursor-default'
        }`}
        data-placeholder={isEditing ? "写下你的想法..." : undefined}
        style={{
          ...textStyle,
          minHeight: '100%',
        }}
      />

      {/* 属性面板 */}
      {isSelected && !isEditing && showPropertyPanel && (
        <div className="absolute -right-[220px] top-1/2 -translate-y-1/2 z-10">
          <PropertyPanel node={node} showBackgroundColor={false} />
        </div>
      )}

      {/* 调整大小手柄 - 橄榄绿配色 */}
      {isSelected && !isEditing && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full cursor-nwse-resize transition-colors z-10"
          style={{
            background: 'rgba(139, 142, 99, 0.5)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.7)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.5)'}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* 文本工具栏 */}
      {isEditing && selectedText && selectionRelativePos && getToolbarScreenPosition() && (
        <TextToolbar
          position={getToolbarScreenPosition()!}
          selectedText={selectedText}
          onBold={applyBold}
          onItalic={applyItalic}
          onUnderline={applyUnderline}
          onStrikethrough={applyStrikethrough}
          onFontSize={applyFontSize}
          onColor={applyColor}
          onBackgroundColor={applyBackgroundColor}
          onAddTo={handleAddTo}
        />
      )}

      {/* AI 确认工具栏 */}
      {node.aiMetadata?.confirmStatus === 'pending' &&
       node.aiMetadata.chatId &&
       node.aiMetadata.messageId &&
       node.aiMetadata.toolIndex !== undefined && (
        <AIConfirmToolbar
          nodeId={node.id}
          chatId={node.aiMetadata.chatId}
          messageId={node.aiMetadata.messageId}
          toolIndex={node.aiMetadata.toolIndex}
          nodeWidth={node.size.width}
        />
      )}
    </div>
  );
}
