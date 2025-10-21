'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/store';
import type { CanvasNode, NodeStyle } from '@/types';

interface PropertyPanelProps {
  node: CanvasNode;
  showBackgroundColor?: boolean; // 是否显示背景颜色选择，默认true
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
  { name: '透明', value: 'transparent' },
  { name: '白色', value: '#FFFFFF' },
  { name: '黄色', value: '#FEF3C7' },
  { name: '粉色', value: '#FCE7F3' },
  { name: '蓝色', value: '#DBEAFE' },
  { name: '绿色', value: '#D1FAE5' },
  { name: '紫色', value: '#EDE9FE' },
  { name: '灰色', value: '#F3F4F6' },
];

export default function PropertyPanel({ node, showBackgroundColor = true }: PropertyPanelProps) {
  const { updateNode } = useCanvasStore();
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const currentStyle: NodeStyle = node.style || {};
  const fontSize = currentStyle.fontSize || 14;
  const fontWeight = currentStyle.fontWeight || 'normal';
  const textColor = currentStyle.textColor || '#000000';
  const backgroundColor = currentStyle.backgroundColor || 'transparent';

  const updateStyle = (updates: Partial<NodeStyle>) => {
    updateNode(node.id, {
      style: {
        ...currentStyle,
        ...updates,
      },
    });
  };

  return (
    <div
      className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2 w-[160px] animate-in fade-in-0 zoom-in-95 duration-200"
      style={{ transformOrigin: 'top left' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* 字体大小 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600 font-medium">字体大小</label>
        <input
          type="number"
          min="8"
          max="72"
          value={fontSize}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 8 && value <= 72) {
              updateStyle({ fontSize: value });
            }
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full px-3 py-1.5 text-sm text-gray-900 rounded border border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="字体大小 (8-72)"
        />
      </div>

      {/* 字体粗细 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600 font-medium">字体粗细</label>
        <div className="flex gap-1">
          <button
            onClick={() => updateStyle({ fontWeight: 'normal' })}
            className={`
              flex-1 px-3 py-1.5 text-xs rounded border transition-all
              ${fontWeight === 'normal'
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }
            `}
          >
            正常
          </button>
          <button
            onClick={() => updateStyle({ fontWeight: 'bold' })}
            className={`
              flex-1 px-3 py-1.5 text-xs font-bold rounded border transition-all
              ${fontWeight === 'bold'
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }
            `}
          >
            加粗
          </button>
        </div>
      </div>

      {/* 文字颜色 */}
      <div className="flex flex-col gap-1 relative">
        <label className="text-xs text-gray-600 font-medium">文字颜色</label>
        <button
          onClick={() => setShowTextColorPicker(!showTextColorPicker)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded border border-gray-300 hover:border-blue-400 bg-white transition-colors"
        >
          <div
            className="w-4 h-4 rounded border border-gray-300"
            style={{ backgroundColor: textColor }}
          />
          <span className="text-xs text-gray-700">选择颜色</span>
        </button>
        {showTextColorPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    updateStyle({ textColor: color.value });
                    setShowTextColorPicker(false);
                  }}
                  className="group flex flex-col items-center gap-1 p-1.5 rounded hover:bg-gray-100 transition-colors"
                  title={color.name}
                >
                  <div
                    className={`w-6 h-6 rounded border-2 transition-all ${
                      textColor === color.value ? 'border-blue-500 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-[10px] text-gray-600">{color.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 背景颜色 - 只在允许时显示 */}
      {showBackgroundColor && (
        <div className="flex flex-col gap-1 relative">
          <label className="text-xs text-gray-600 font-medium">背景颜色</label>
          <button
            onClick={() => setShowBgColorPicker(!showBgColorPicker)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded border border-gray-300 hover:border-blue-400 bg-white transition-colors"
          >
            <div
              className="w-4 h-4 rounded border border-gray-300"
              style={{
                backgroundColor: backgroundColor === 'transparent' ? '#FFFFFF' : backgroundColor,
                backgroundImage: backgroundColor === 'transparent'
                  ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                  : 'none',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 4px 4px'
              }}
            />
            <span className="text-xs text-gray-700">选择颜色</span>
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
              <div className="grid grid-cols-3 gap-1.5">
                {BG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      updateStyle({ backgroundColor: color.value });
                      setShowBgColorPicker(false);
                    }}
                    className="group flex flex-col items-center gap-1 p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title={color.name}
                  >
                    <div
                      className={`w-6 h-6 rounded border-2 transition-all ${
                        backgroundColor === color.value ? 'border-blue-500 scale-110' : 'border-gray-300'
                      }`}
                      style={{
                        backgroundColor: color.value === 'transparent' ? '#FFFFFF' : color.value,
                        backgroundImage: color.value === 'transparent'
                          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                          : 'none',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 4px 4px'
                      }}
                    />
                    <span className="text-[10px] text-gray-600">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
