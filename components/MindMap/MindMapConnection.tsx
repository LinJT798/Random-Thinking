'use client';

import type { CanvasNode, Position } from '@/types';

interface MindMapConnectionProps {
  parentNode: CanvasNode;
  childNode: CanvasNode;
  viewportOffset: Position;
  zoom: number;
}

export default function MindMapConnection({
  parentNode,
  childNode,
  viewportOffset,
  zoom
}: MindMapConnectionProps) {
  // 计算父节点和子节点的中心点位置
  const parentCenter = {
    x: parentNode.position.x + parentNode.size.width,
    y: parentNode.position.y + parentNode.size.height / 2
  };

  const childCenter = {
    x: childNode.position.x,
    y: childNode.position.y + childNode.size.height / 2
  };

  // 计算贝塞尔曲线控制点
  const controlPointDistance = Math.abs(childCenter.x - parentCenter.x) * 0.5;

  // 根据子节点层级调整颜色和粗细
  const level = childNode.mindMapMetadata?.level || 0;
  const strokeWidth = Math.max(2, 4 - level * 0.5);
  const opacity = Math.max(0.3, 1 - level * 0.1);

  // 构建SVG路径
  const path = `
    M ${parentCenter.x} ${parentCenter.y}
    C ${parentCenter.x + controlPointDistance} ${parentCenter.y},
      ${childCenter.x - controlPointDistance} ${childCenter.y},
      ${childCenter.x} ${childCenter.y}
  `;

  return (
    <path
      d={path}
      stroke="#6366f1"
      strokeWidth={strokeWidth}
      opacity={opacity}
      fill="none"
      strokeLinecap="round"
    />
  );
}
