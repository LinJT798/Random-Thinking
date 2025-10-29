'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '@/lib/store';
import { calculateTextNodeSize } from '@/lib/text-size-calculator';
import TextNode from '../Nodes/TextNode';
import StickyNote from '../Nodes/StickyNote';
import MindMapNode from '../MindMap/MindMapNode';
import MindMapConnection from '../MindMap/MindMapConnection';
import ChatButton from '../Chat/ChatButton';
import ChatWindow from '../Chat/ChatWindow';
import SettingsMenu from './SettingsMenu';
import type { CanvasNode, Position } from '@/types';
import type { SyncStatus as SyncStatusType } from '@/lib/sync-manager';

interface CanvasProps {
  canvasId: string;
  syncStatus: SyncStatusType;
}

export default function Canvas({ canvasId, syncStatus }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportOffset, setViewportOffset] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const { nodes, loadCanvas, selectedNodeIds, selectNode, clearSelection, addNode, undo, redo, chatSessions, draggingText, setDraggingText, dockedChatId, dockedWidth } = useCanvasStore();

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

  // 阻止浏览器的后退/前进手势（二指左右滑）
  useEffect(() => {
    const preventNavigation = (e: WheelEvent) => {
      // 检测水平滚动（二指左右滑）
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // 阻止浏览器的后退/前进导航
        e.preventDefault();
      }
    };

    // 必须使用 { passive: false } 才能调用 preventDefault()
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', preventNavigation, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', preventNavigation);
      };
    }
  }, []);

  // 监听焦点节点事件，移动视角
  useEffect(() => {
    const handleFocusNode = (e: CustomEvent) => {
      const { x, y } = e.detail;

      // 计算视角偏移，使节点居中显示
      const newOffsetX = window.innerWidth / 2 - x * zoom;
      const newOffsetY = window.innerHeight / 2 - y * zoom;

      setViewportOffset({ x: newOffsetX, y: newOffsetY });
    };

    window.addEventListener('focusNode', handleFocusNode as EventListener);
    return () => window.removeEventListener('focusNode', handleFocusNode as EventListener);
  }, [zoom]);

  // 处理画布点击（取消选择或创建拖拽的文本节点）
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // 如果有拖拽的文本，创建新节点
      if (draggingText) {
        // 获取画布元素的边界（考虑分屏模式的偏移）
        const canvasBounds = canvasRef.current?.getBoundingClientRect();
        if (!canvasBounds) return;

        // 计算相对于画布左上角的鼠标位置
        const mouseX = e.clientX - canvasBounds.left;
        const mouseY = e.clientY - canvasBounds.top;

        // 转换为画布坐标系
        const x = (mouseX - viewportOffset.x) / zoom;
        const y = (mouseY - viewportOffset.y) / zoom;

        // 计算文本所需的尺寸
        const size = calculateTextNodeSize(draggingText);

        await addNode({
          type: 'text',
          content: draggingText,
          position: { x, y },
          size,
          connections: [],
        });

        // 清除拖拽文本
        setDraggingText(null);
      } else {
        // 没有拖拽文本，只是取消选择
        clearSelection();
      }
    }
  }, [clearSelection, draggingText, setDraggingText, viewportOffset, zoom, addNode]);

  // 处理双击画布（创建文本节点）
  const handleCanvasDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // 获取画布元素的边界（考虑分屏模式的偏移）
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;

      // 计算相对于画布左上角的鼠标位置
      const mouseX = e.clientX - canvasBounds.left;
      const mouseY = e.clientY - canvasBounds.top;

      // 转换为画布坐标系
      const x = (mouseX - viewportOffset.x) / zoom;
      const y = (mouseY - viewportOffset.y) / zoom;

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
      case 'mindmap':
        return <MindMapNode key={node.id} {...commonProps} />;
      case 'text':
      case 'ai-generated':
      default:
        return <TextNode key={node.id} {...commonProps} />;
    }
  };

  // 渲染思维导图连线
  const renderMindMapConnections = () => {
    const connections: React.ReactElement[] = [];

    nodes.forEach(node => {
      if (node.parentId) {
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
          connections.push(
            <MindMapConnection
              key={`conn-${parentNode.id}-${node.id}`}
              parentNode={parentNode}
              childNode={node}
              viewportOffset={viewportOffset}
              zoom={zoom}
            />
          );
        }
      }
    });

    return connections;
  };

  return (
    <div
      ref={canvasRef}
      className="relative h-screen overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-500 elastic-transition"
      style={{
        marginLeft: dockedChatId ? `${dockedWidth}vw` : '0',
        width: dockedChatId ? `${100 - dockedWidth}vw` : '100%',
        background: 'linear-gradient(180deg, #F9F6F1 0%, #F3EFE9 100%)',
      }}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 点状网格背景 - 暖灰色，更大更明显 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(122, 111, 103, 0.35) 1.2px, transparent 1.5px)`,
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
        {/* 思维导图连线层 (SVG) */}
        <svg
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: '10000px',
            height: '10000px',
            overflow: 'visible',
          }}
        >
          {renderMindMapConnections()}
        </svg>

        {/* 节点层 */}
        {nodes.map(renderNode)}
      </div>

      {/* 缩放控制 - 立体边缘效果 */}
      <div
        className="absolute bottom-6 right-6 flex flex-col gap-0.5 rounded-xl p-2 glass-effect z-[2000]"
        style={{
          background: '#EDE4D5',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all elastic-transition"
          style={{ color: '#3D342C' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="放大 (Ctrl + 滚轮)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="w-10 h-8 flex items-center justify-center text-xs font-medium" style={{ color: '#7A6F67' }}>
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all elastic-transition"
          style={{ color: '#3D342C' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="缩小 (Ctrl + 滚轮)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>
        <div className="w-10 border-t my-1" style={{ borderColor: 'rgba(122, 111, 103, 0.2)' }} />
        <button
          onClick={() => {
            if (nodes.length === 0) {
              // 没有节点，重置到原点
              setZoom(1);
              setViewportOffset({ x: 0, y: 0 });
              return;
            }

            // 计算所有节点的边界框
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            nodes.forEach(node => {
              const nodeLeft = node.position.x;
              const nodeTop = node.position.y;
              const nodeRight = node.position.x + node.size.width;
              const nodeBottom = node.position.y + node.size.height;

              minX = Math.min(minX, nodeLeft);
              minY = Math.min(minY, nodeTop);
              maxX = Math.max(maxX, nodeRight);
              maxY = Math.max(maxY, nodeBottom);
            });

            // 计算节点群的中心点（画布坐标）
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // 计算视口大小（考虑分屏）
            const viewportWidth = dockedChatId
              ? window.innerWidth * (100 - dockedWidth) / 100
              : window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 移动视口，使节点中心在屏幕中央
            const newOffsetX = viewportWidth / 2 - centerX * zoom;
            const newOffsetY = viewportHeight / 2 - centerY * zoom;

            setViewportOffset({ x: newOffsetX, y: newOffsetY });
          }}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all elastic-transition"
          style={{ color: '#7A6F67' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 142, 99, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="居中显示所有节点"
        >
          {/* 标准准心图标 */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {/* 圆环 */}
            <circle cx="12" cy="12" r="6" />
            {/* 上方准线 */}
            <path strokeLinecap="round" d="M12 2v4" />
            {/* 下方准线 */}
            <path strokeLinecap="round" d="M12 18v4" />
            {/* 左侧准线 */}
            <path strokeLinecap="round" d="M2 12h4" />
            {/* 右侧准线 */}
            <path strokeLinecap="round" d="M18 12h4" />
            {/* 中心点 */}
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* 左上角按钮 - 独立定位，最高层级 */}
      <div className="absolute top-6 left-6 z-[2000]">
        <SettingsMenu syncStatus={syncStatus} />
      </div>
      <div className="absolute top-6 left-20 z-[2000]">
        <ChatButton />
      </div>

      {/* 聊天窗口 */}
      {chatSessions
        .filter(session => session.isOpen)
        .map(session => (
          <ChatWindow key={session.id} chatId={session.id} />
        ))}
    </div>
  );
}
