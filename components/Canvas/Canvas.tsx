'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import TextNode from '../Nodes/TextNode';
import StickyNote from '../Nodes/StickyNote';
import type { CanvasNode, Position } from '@/types';

interface CanvasProps {
  canvasId: string;
}

export default function Canvas({ canvasId }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportOffset, setViewportOffset] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const { nodes, loadCanvas, selectedNodeIds, selectNode, clearSelection } = useCanvasStore();

  // 加载画布数据
  useEffect(() => {
    loadCanvas(canvasId);
  }, [canvasId, loadCanvas]);

  // 处理画布点击（取消选择）
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  }, [clearSelection]);

  // 处理鼠标按下（开始平移）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 只在空白区域且按住空格键或中键时启用平移
    if (e.target === e.currentTarget && (e.button === 1 || e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewportOffset.x, y: e.clientY - viewportOffset.y });
      e.preventDefault();
    }
  }, [viewportOffset]);

  // 处理鼠标移动（平移）
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewportOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  // 处理鼠标释放（结束平移）
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // 处理滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      setZoom(prev => Math.max(0.1, Math.min(3, prev + delta)));
    } else {
      // 普通滚动 - 平移画布
      setViewportOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  // 渲染节点
  const renderNode = (node: CanvasNode) => {
    const isSelected = selectedNodeIds.includes(node.id);

    const commonProps = {
      node,
      isSelected,
      onSelect: () => selectNode(node.id),
      zoom,
    };

    switch (node.type) {
      case 'sticky':
        return <StickyNote key={node.id} {...commonProps} />;
      case 'text':
      case 'ai-generated':
      default:
        return <TextNode key={node.id} {...commonProps} />;
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-screen overflow-hidden bg-gray-50 cursor-grab active:cursor-grabbing"
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 网格背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
          backgroundPosition: `${viewportOffset.x}px ${viewportOffset.y}px`,
        }}
      />

      {/* 画布内容 */}
      <div
        className="relative"
        style={{
          transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map(renderNode)}
      </div>

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
          className="px-3 py-1 hover:bg-gray-100 rounded"
          title="放大 (Ctrl + 滚轮)"
        >
          +
        </button>
        <div className="text-center text-sm text-gray-600 px-2">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
          className="px-3 py-1 hover:bg-gray-100 rounded"
          title="缩小 (Ctrl + 滚轮)"
        >
          -
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setViewportOffset({ x: 0, y: 0 });
          }}
          className="px-3 py-1 hover:bg-gray-100 rounded text-xs"
          title="重置视图"
        >
          重置
        </button>
      </div>

      {/* 提示信息 */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm text-gray-600">
        <div>按住 Shift + 拖动鼠标 = 平移画布</div>
        <div>Ctrl/Cmd + 滚轮 = 缩放</div>
        <div>滚轮 = 移动画布</div>
      </div>
    </div>
  );
}
