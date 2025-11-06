'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TextToolbarProps {
  position: { x: number; y: number };
  selectedText: string;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onFontSize: (size: number) => void;
  onColor: (color: string) => void;
  onBackgroundColor: (color: string) => void;
  onAddTo: () => void;
}

const TEXT_COLORS = [
  { name: '黑色', value: '#000000' },
  { name: '灰色', value: '#6B7280' },
  { name: '红色', value: '#EF4444' },
  { name: '橙色', value: '#F97316' },
  { name: '黄色', value: '#EAB308' },
  { name: '绿色', value: '#10B981' },
  { name: '蓝色', value: '#3B82F6' },
  { name: '紫色', value: '#8B5CF6' },
  { name: '粉色', value: '#EC4899' },
];

const BG_COLORS = [
  { name: '无', value: 'transparent' },
  { name: '黄色', value: '#FEF3C7' },
  { name: '粉色', value: '#FCE7F3' },
  { name: '蓝色', value: '#DBEAFE' },
  { name: '绿色', value: '#D1FAE5' },
  { name: '紫色', value: '#EDE9FE' },
];

const FONT_SIZES = [
  { name: '12px', value: 12 },
  { name: '14px', value: 14 },
  { name: '16px', value: 16 },
  { name: '18px', value: 18 },
  { name: '20px', value: 20 },
  { name: '24px', value: 24 },
];

export default function TextToolbar({
  position,
  selectedText,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onFontSize,
  onColor,
  onBackgroundColor,
  onAddTo,
}: TextToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [toolbarSize, setToolbarSize] = useState({ width: 0, height: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 检测工具栏当前格式状态
  const isBold = document.queryCommandState('bold');
  const isItalic = document.queryCommandState('italic');
  const isUnderline = document.queryCommandState('underline');
  const isStrikethrough = document.queryCommandState('strikeThrough');

  // 检测选区的字体大小
  const getCurrentFontSize = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '14px';

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 1 ? container as HTMLElement : container.parentElement;

    if (element) {
      const fontSize = window.getComputedStyle(element).fontSize;
      return fontSize; // 返回如 "14px"
    }

    return '14px';
  };

  const currentFontSize = getCurrentFontSize();

  // 位置变化时重置可见性
  useEffect(() => {
    setIsVisible(false);
  }, [position.x, position.y]);

  // 测量工具栏尺寸并延迟显示，避免闪烁
  useEffect(() => {
    if (toolbarRef.current && !isVisible) {
      const rect = toolbarRef.current.getBoundingClientRect();
      setToolbarSize({ width: rect.width, height: rect.height });

      // 延迟一帧显示，确保尺寸已计算
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [isVisible, position.x, position.y]); // 位置变化时重新测量

  // 点击外部关闭颜色选择器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  if (!selectedText || typeof window === 'undefined') {
    return null;
  }

  // 计算精确定位（避免百分比 transform 的闪烁）
  const toolbarLeft = toolbarSize.width > 0
    ? position.x - toolbarSize.width / 2
    : position.x - 200; // 预估宽度

  const toolbarTop = toolbarSize.height > 0
    ? position.y - toolbarSize.height - 6
    : position.y - 50; // 预估高度

  return createPortal(
    <div
      ref={toolbarRef}
      data-text-toolbar="true"
      className="fixed z-[2000] glass-effect rounded-xl p-1 flex items-center gap-1 transition-opacity duration-150"
      style={{
        left: `${toolbarLeft}px`,
        top: `${toolbarTop}px`,
        opacity: isVisible ? 1 : 0, // 延迟显示避免闪烁
        background: '#EDE4D5',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 12px rgba(61, 52, 44, 0.15)',
      }}
      onMouseDown={(e) => e.preventDefault()} // 防止点击时清除选区
    >
      {/* 粗体按钮 */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onBold();
        }}
        className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all text-sm font-bold"
        style={{
          background: isBold ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
          color: isBold ? '#fff' : '#3D342C',
          border: isBold ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
        }}
        title="粗体 (Ctrl+B)"
      >
        B
      </button>

      {/* 斜体按钮 */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onItalic();
        }}
        className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all text-sm italic"
        style={{
          background: isItalic ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
          color: isItalic ? '#fff' : '#3D342C',
          border: isItalic ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
        }}
        title="斜体 (Ctrl+I)"
      >
        I
      </button>

      {/* 下划线按钮 */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onUnderline();
        }}
        className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all text-sm underline"
        style={{
          background: isUnderline ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
          color: isUnderline ? '#fff' : '#3D342C',
          border: isUnderline ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
        }}
        title="下划线 (Ctrl+U)"
      >
        U
      </button>

      {/* 删除线按钮 */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onStrikethrough();
        }}
        className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all text-sm"
        style={{
          background: isStrikethrough ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
          color: isStrikethrough ? '#fff' : '#3D342C',
          border: isStrikethrough ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
          textDecoration: 'line-through',
        }}
        title="删除线"
      >
        S
      </button>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300 mx-0.5" />

      {/* 字体大小选择器 */}
      <div className="relative">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            // 关闭其他下拉菜单
            setShowColorPicker(false);
            setShowBgColorPicker(false);
            // 切换当前下拉
            setShowFontSizePicker(!showFontSizePicker);
          }}
          className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs"
          style={{
            background: showFontSizePicker ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
            color: showFontSizePicker ? '#fff' : '#3D342C',
            border: showFontSizePicker ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
          }}
          title="字体大小"
        >
          <span>{currentFontSize}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 字体大小下拉菜单 */}
        {showFontSizePicker && (
          <div
            className="absolute top-full left-0 mt-1 rounded-lg p-1 z-50 glass-effect dropdown-animate-in"
            style={{
              background: '#EDE4D5',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              minWidth: '80px',
            }}
          >
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  onFontSize(size.value);
                  setShowFontSizePicker(false);
                }}
                className="w-full px-3 py-1.5 text-left rounded transition-colors text-sm"
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                style={{ color: '#3D342C' }}
              >
                {size.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300 mx-0.5" />

      {/* 颜色选择器 */}
      <div className="relative">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            // 关闭其他下拉菜单
            setShowFontSizePicker(false);
            setShowBgColorPicker(false);
            // 切换当前下拉
            setShowColorPicker(!showColorPicker);
          }}
          className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
          style={{
            background: showColorPicker ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
            color: showColorPicker ? '#fff' : '#3D342C',
            border: showColorPicker ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
          }}
          title="文字颜色"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="text-xs">A</span>
        </button>

        {/* 颜色选择器下拉面板 */}
        {showColorPicker && (
          <div
            className="absolute top-full left-0 mt-1 rounded-lg p-2 z-50 glass-effect dropdown-animate-in"
            style={{
              background: '#EDE4D5',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              minWidth: '140px',
            }}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    onColor(color.value);
                    setShowColorPicker(false);
                  }}
                  className="group p-1.5 rounded transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={color.name}
                >
                  <div
                    className="w-6 h-6 rounded transition-all"
                    style={{
                      backgroundColor: color.value,
                      border: '2px solid rgba(122, 111, 103, 0.3)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300 mx-0.5" />

      {/* 背景色选择器 */}
      <div className="relative">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            // 关闭其他下拉菜单
            setShowFontSizePicker(false);
            setShowColorPicker(false);
            // 切换当前下拉
            setShowBgColorPicker(!showBgColorPicker);
          }}
          className="toolbar-btn px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
          style={{
            background: showBgColorPicker ? 'rgba(139, 142, 99, 0.9)' : 'rgba(248, 244, 239, 0.8)',
            color: showBgColorPicker ? '#fff' : '#3D342C',
            border: showBgColorPicker ? '1px solid rgba(139, 142, 99, 1)' : '1px solid rgba(122, 111, 103, 0.2)',
          }}
          title="背景色"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="text-xs">Bg</span>
        </button>

        {/* 背景色下拉面板 */}
        {showBgColorPicker && (
          <div
            className="absolute top-full left-0 mt-1 rounded-lg p-2 z-50 glass-effect dropdown-animate-in"
            style={{
              background: '#EDE4D5',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              minWidth: '140px',
            }}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {BG_COLORS.map((color) => (
                <button
                  key={color.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    onBackgroundColor(color.value);
                    setShowBgColorPicker(false);
                  }}
                  className="group p-1.5 rounded transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={color.name}
                >
                  <div
                    className="w-6 h-6 rounded transition-all"
                    style={{
                      backgroundColor: color.value === 'transparent' ? '#FFFFFF' : color.value,
                      backgroundImage: color.value === 'transparent'
                        ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                        : 'none',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px',
                      border: '2px solid rgba(122, 111, 103, 0.3)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300 mx-0.5" />

      {/* Add to 按钮 */}
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onAddTo();
        }}
        className="toolbar-btn-primary px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-white text-sm font-medium"
        style={{
          background: 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 1) 0%, rgba(196, 129, 76, 0.95) 100%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)';
        }}
        title="创建新节点"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Add to</span>
      </button>
    </div>,
    document.body
  );
}
