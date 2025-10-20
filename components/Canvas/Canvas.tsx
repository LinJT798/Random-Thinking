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

  const { nodes, loadCanvas, selectedNodeIds, selectNode, clearSelection, addNode, undo, redo } = useCanvasStore();

  // 加载画布数据
  useEffect(() => {
    loadCanvas(canvasId);
  }, [canvasId, loadCanvas]);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z (Mac) 或 Ctrl+Z (Windows/Linux) - 撤销
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z (Mac) 或 Ctrl+Shift+Z (Windows/Linux) - 重做
      else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd+Y (Windows/Linux 的重做快捷键)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // 处理画布点击（取消选择）
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  }, [clearSelection]);

  // 处理双击画布（创建文本节点）
  const handleCanvasDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // 计算在画布坐标系中的位置
      const x = (e.clientX - viewportOffset.x) / zoom;
      const y = (e.clientY - viewportOffset.y) / zoom;

      await addNode({
        type: 'text',
        content: '',
        position: { x, y },
        size: { width: 300, height: 150 },
        connections: [],
      });
    }
  }, [viewportOffset, zoom, addNode]);

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
      className="relative w-full h-screen overflow-hidden bg-white cursor-grab active:cursor-grabbing"
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
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
            linear-gradient(to right, #f3f4f6 0.5px, transparent 0.5px),
            linear-gradient(to bottom, #f3f4f6 0.5px, transparent 0.5px)
          `,
          backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
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
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/50 p-1.5">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100/80 rounded-xl transition-all text-gray-700 font-medium"
          title="放大 (Ctrl + 滚轮)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="text-center text-xs text-gray-500 px-2 py-1 font-medium">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100/80 rounded-xl transition-all text-gray-700 font-medium"
          title="缩小 (Ctrl + 滚轮)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="border-t border-gray-200/50 my-0.5" />
        <button
          onClick={() => {
            setZoom(1);
            setViewportOffset({ x: 0, y: 0 });
          }}
          className="w-9 h-9 flex items-center justify-center hover:bg-gray-100/80 rounded-xl transition-all text-gray-600"
          title="重置视图"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* 提示信息 */}
      <div className="absolute top-6 left-6 bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/50 px-4 py-3 text-xs text-gray-600 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">⌘</span>
          <span className="font-medium">双击画布创建文本</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">⇧</span>
          <span>Shift + 拖动平移</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">⌃</span>
          <span>Ctrl + 滚轮缩放</span>
        </div>
      </div>
    </div>
  );
}
