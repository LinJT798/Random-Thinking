import type { CanvasNode, Position } from '@/types';

interface LayoutOptions {
  width: number;
  height: number;
  nodes: CanvasNode[];
  preferredPosition?: Position;
}

/**
 * 检查两个矩形区域是否重叠
 */
function isOverlapping(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
  spacing: number = 50
): boolean {
  return (
    x1 < x2 + w2 + spacing &&
    x1 + w1 + spacing > x2 &&
    y1 < y2 + h2 + spacing &&
    y1 + h1 + spacing > y2
  );
}

/**
 * 获取节点的实际占用尺寸（考虑思维导图展开）
 */
function getNodeOccupiedSize(node: CanvasNode): { width: number; height: number } {
  // 思维导图根节点会展开很大
  if (node.type === 'mindmap' && node.mindMapMetadata?.level === 0) {
    return { width: 2000, height: 1200 };
  }
  return node.size;
}

/**
 * 检查给定位置是否与任何现有节点重叠
 */
function checkCollision(
  x: number,
  y: number,
  width: number,
  height: number,
  nodes: CanvasNode[]
): boolean {
  return nodes.some(node => {
    const occupied = getNodeOccupiedSize(node);
    return isOverlapping(
      x, y, width, height,
      node.position.x, node.position.y, occupied.width, occupied.height
    );
  });
}

/**
 * 智能查找无重叠的位置
 * 策略：尝试多个候选位置，直到找到不重叠的位置
 */
export function findNonOverlappingPosition(options: LayoutOptions): Position {
  const { width, height, nodes, preferredPosition } = options;
  const spacing = 50;

  // 如果没有节点，返回默认位置
  if (nodes.length === 0) {
    return preferredPosition || { x: 100, y: 100 };
  }

  // 如果有首选位置且不重叠，直接使用
  if (preferredPosition && !checkCollision(preferredPosition.x, preferredPosition.y, width, height, nodes)) {
    return preferredPosition;
  }

  // 找到最近创建的节点作为参考点
  const latestNode = nodes.reduce((latest, node) =>
    node.createdAt > latest.createdAt ? node : latest
  );

  const refOccupied = getNodeOccupiedSize(latestNode);
  const refX = latestNode.position.x;
  const refY = latestNode.position.y;

  // 定义多个候选位置策略
  const candidates: Position[] = [
    // 1. 右侧（首选）
    { x: refX + refOccupied.width + spacing, y: refY },

    // 2. 下方
    { x: refX, y: refY + refOccupied.height + spacing },

    // 3. 右下方
    { x: refX + refOccupied.width + spacing, y: refY + refOccupied.height + spacing },

    // 4. 左侧
    { x: refX - width - spacing, y: refY },

    // 5. 上方
    { x: refX, y: refY - height - spacing },

    // 6. 右上方
    { x: refX + refOccupied.width + spacing, y: refY - height - spacing },

    // 7. 左下方
    { x: refX - width - spacing, y: refY + refOccupied.height + spacing },

    // 8. 左上方
    { x: refX - width - spacing, y: refY - height - spacing },
  ];

  // 尝试每个候选位置
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!checkCollision(candidate.x, candidate.y, width, height, nodes)) {
      return candidate;
    }
  }

  // 如果所有预定义位置都重叠，使用网格搜索
  // 从参考节点开始，螺旋式向外搜索
  const gridSize = 150; // 网格步长
  const maxRadius = 20; // 最大搜索半径

  for (let radius = 1; radius <= maxRadius; radius++) {
    // 在当前半径的所有网格点
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // 只检查边缘上的点（避免重复检查内部）
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          const x = refX + dx * gridSize;
          const y = refY + dy * gridSize;

          if (!checkCollision(x, y, width, height, nodes)) {
            return { x, y };
          }
        }
      }
    }
  }

  // 实在找不到，就放在最右下角
  const maxX = Math.max(...nodes.map(n => n.position.x + getNodeOccupiedSize(n).width));
  const maxY = Math.max(...nodes.map(n => n.position.y + getNodeOccupiedSize(n).height));

  return {
    x: maxX + spacing,
    y: maxY + spacing
  };
}
