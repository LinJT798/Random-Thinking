'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';
import { useTextSelection } from '@/hooks/useTextSelection';
import TextToolbar from './TextToolbar';
import PropertyPanel from '../PropertyPanel/PropertyPanel';
import type { CanvasNode } from '@/types';

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  zoom: number;
  viewportOffset: { x: number; y: number };
}

export default function TextNode({ node, isSelected, onSelect, zoom, viewportOffset }: TextNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const { updateNode, deleteNode, setDraggingText } = useCanvasStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false); // 标记是否刚刚选中节点

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
        // 保存选区
        const range = selection.getRangeAt(0);
        setSavedRange(range.cloneRange());

        // 获取选区在屏幕上的位置
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();

        // 计算选区相对于编辑器的位置（屏幕像素偏移）
        const offsetScreenX = rect.left + rect.width / 2 - editorRect.left;
        const offsetScreenY = rect.top - editorRect.top;

        // 转换为画布坐标的偏移
        const relativeX = offsetScreenX / zoom;
        const relativeY = offsetScreenY / zoom;

        setSelectedText(text);
        setSelectionRelativePos({ x: relativeX, y: relativeY });
      }
      // 不主动清除选区，让用户点击其他地方时自然清除
    }, 10);
  };

  // 清除选区
  const clearSelection = () => {
    setSelectedText('');
    setSelectionRelativePos(null);
    setSavedRange(null);
  };

  // 计算工具栏在屏幕上的绝对位置
  const getToolbarScreenPosition = () => {
    if (!selectionRelativePos || !editorRef.current) return null;

    // 获取编辑器当前在屏幕上的位置
    const editorRect = editorRef.current.getBoundingClientRect();

    // 选区相对于编辑器的屏幕偏移（已缩放）
    const offsetScreenX = selectionRelativePos.x * zoom;
    const offsetScreenY = selectionRelativePos.y * zoom;

    // 选区在屏幕上的绝对位置
    const screenX = editorRect.left + offsetScreenX;
    const screenY = editorRect.top + offsetScreenY;

    return { x: screenX, y: screenY };
  };

  // 恢复选区（用于工具栏操作后）
  const restoreSelection = () => {
    if (savedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    }
  };

  // 初始化内容（组件首次挂载或 node.content 外部更新时）
  useEffect(() => {
    if (editorRef.current && !isEditing) {
      // 只在非编辑模式下同步外部内容变化
      const displayContent = node.content || '<span style="color: #9CA3AF">双击编辑...</span>';
      editorRef.current.innerHTML = displayContent;
    }
  }, [node.content, isEditing]);

  // 进入编辑模式时的初始化
  useEffect(() => {
    if (isEditing && editorRef.current) {
      // 设置初始内容
      editorRef.current.innerHTML = node.content;

      // 聚焦并选中所有内容
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]); // 只依赖 isEditing，不依赖 node.content

  // 保存内容
  const handleBlur = () => {
    setIsEditing(false);
    clearSelection(); // 清除选中状态

    // 获取 HTML 内容并保存
    const htmlContent = editorRef.current?.innerHTML || '';
    if (htmlContent !== node.content) {
      updateNode(node.id, { content: htmlContent });
    }
  };

  // 格式化功能（保持选区）
  const applyBold = () => {
    restoreSelection();
    document.execCommand('bold', false);
    editorRef.current?.focus();
    // 重新保存选区
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

    // 保存选区文本内容
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedContent = range.extractContents();

    // 创建带字号的 span
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    span.appendChild(selectedContent);

    // 插入到原位置
    range.insertNode(span);

    // 重新选中这个 span 的内容
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editorRef.current?.focus();

    // 保存新的选区
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

  // Add to 功能
  const handleAddTo = () => {
    if (selectedText) {
      setDraggingText(selectedText);
      clearSelection();
      window.getSelection()?.removeAllRanges();
    }
  };

  // 监听点击清除选区（只要不是点击工具栏，都清除）
  useEffect(() => {
    if (!isEditing || !selectedText) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 只要点击的不是工具栏，就清除选区（即使点击编辑器内部也清除）
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
      // 恢复原内容
      if (editorRef.current) {
        editorRef.current.innerHTML = node.content;
      }
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
    // 快捷键支持
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

    // 如果刚刚选中（这次点击触发的选中），不进入编辑
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    // 如果之前已经选中，则进入编辑模式
    if (isSelected) {
      setIsEditing(true);
      // 延迟聚焦，让光标定位到点击位置
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();

          // 获取点击位置并设置光标
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

    // 如果未选中，选中节点并标记
    if (!isSelected) {
      onSelect();
      justSelectedRef.current = true; // 标记为刚刚选中
    }

    // 记录鼠标按下的位置，用于判断是否拖拽
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 如果移动距离超过 5px，开始拖拽
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
    color: currentStyle.textColor || '#3D342C', // 深咖色替代深灰
  };

  return (
    <div
      ref={nodeRef}
      className={`
        absolute
        ${isEditing ? 'cursor-default' : 'select-none'}
        ${isEditing ? 'cursor-default' : isDragging ? 'opacity-60 cursor-move' : 'cursor-move'}
        ${isResizing ? 'cursor-nwse-resize' : ''}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        height: node.size.height,
        ...(isSelected && {
          boxShadow: '0 0 0 2px rgba(139, 142, 99, 0.5)',
        }),
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div
        className="h-full p-1.5 rounded-xl transition-all"
        style={{
          backgroundColor: backgroundColor !== 'transparent' ? backgroundColor : 'transparent',
          boxShadow: backgroundColor !== 'transparent' ? '0 4px 12px rgba(61, 52, 44, 0.08)' : 'none',
          border: backgroundColor !== 'transparent' ? '1px solid rgba(122, 111, 103, 0.15)' : 'none',
          backdropFilter: backgroundColor !== 'transparent' ? 'blur(8px)' : 'none',
        }}
      >
        {/* AI 标记 - 橄榄绿配色 */}
        {isAIGenerated && (
          <div className="absolute -top-2 -right-2 text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{
            background: 'linear-gradient(135deg, rgba(139, 142, 99, 0.95) 0%, rgba(198, 200, 170, 0.95) 100%)',
            boxShadow: '0 2px 8px rgba(61, 52, 44, 0.15)',
          }}>
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>AI</span>
          </div>
        )}

        {/* 内容 */}
        <div
          ref={editorRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onMouseUp={isEditing ? updateSelection : undefined}
          onKeyUp={isEditing ? updateSelection : undefined}
          className={`w-full h-full border-none outline-none font-sans bg-transparent leading-relaxed overflow-auto ${
            isEditing ? 'cursor-text' : 'whitespace-pre-wrap break-words overflow-hidden cursor-default'
          }`}
          data-placeholder={isEditing ? "输入内容... (Ctrl+Enter 保存, Esc 取消)" : undefined}
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
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full cursor-nwse-resize transition-colors z-0"
            style={{
              background: 'rgba(139, 142, 99, 0.5)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.7)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.5)'}
            onMouseDown={handleResizeStart}
          />
        )}
      </div>

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
    </div>
  );
}
