import type { CanvasNode } from '@/types';
import { findNonOverlappingPosition } from './smart-layout';

interface MindMapChild {
  content: string;
  children?: MindMapChild[];
}

interface CreateMindMapOptions {
  addNode: (node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  startPosition?: { x: number; y: number };
  getAllNodes: () => CanvasNode[];
}

/**
 * 递归创建思维导图网络
 */
export async function createMindMapNetwork(
  root: string,
  children: MindMapChild[],
  options: CreateMindMapOptions
): Promise<void> {
  const { addNode, startPosition = { x: 100, y: 100 }, getAllNodes } = options;

  // 创建根节点
  const rootId = await addNode({
    type: 'mindmap',
    content: root,
    position: startPosition,
    size: { width: 150, height: 50 },
    connections: [],
    mindMapMetadata: {
      level: 0,
      collapsed: false,
      order: 0,
      layoutType: 'horizontal'
    }
  });

  // 递归创建子节点
  await createChildNodes(rootId, children, 1, 0, startPosition.x, startPosition.y, addNode, getAllNodes);
}

/**
 * 检查位置是否与现有节点重叠（只检查思维导图节点）
 */
function checkMindMapCollision(
  x: number,
  y: number,
  width: number,
  height: number,
  nodes: CanvasNode[],
  spacing: number = 50
): boolean {
  return nodes.some(node => {
    // 只检查思维导图节点的重叠
    if (node.type !== 'mindmap') return false;

    const horizontalOverlap =
      x < node.position.x + node.size.width + spacing &&
      x + width + spacing > node.position.x;
    const verticalOverlap =
      y < node.position.y + node.size.height + spacing &&
      y + height + spacing > node.position.y;
    return horizontalOverlap && verticalOverlap;
  });
}

async function createChildNodes(
  parentId: string,
  children: MindMapChild[],
  level: number,
  startOrder: number,
  parentX: number,
  parentY: number,
  addNode: (node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>,
  getAllNodes: () => CanvasNode[]
): Promise<void> {
  const horizontalSpacing = 250;
  const nodeWidth = 150;
  const nodeHeight = 50;
  const spacing = 50;

  // 动态计算垂直间距，确保不重叠
  let verticalSpacing = 100;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const order = startOrder + i;

    // 获取当前所有节点
    const currentNodes = getAllNodes();

    // 水平布局：子节点在父节点右侧
    const baseX = parentX + horizontalSpacing;
    let finalY = parentY + (i - (children.length - 1) / 2) * verticalSpacing;

    // 如果理想位置重叠，只在垂直方向调整
    let attempts = 0;
    while (checkMindMapCollision(baseX, finalY, nodeWidth, nodeHeight, currentNodes, spacing) && attempts < 20) {
      // 向下移动
      finalY += verticalSpacing / 2;
      attempts++;
    }

    // 如果向下找不到，尝试向上
    if (attempts >= 20) {
      finalY = parentY + (i - (children.length - 1) / 2) * verticalSpacing;
      attempts = 0;
      while (checkMindMapCollision(baseX, finalY, nodeWidth, nodeHeight, currentNodes, spacing) && attempts < 20) {
        // 向上移动
        finalY -= verticalSpacing / 2;
        attempts++;
      }
    }

    // 创建子节点
    const childId = await addNode({
      type: 'mindmap',
      content: child.content,
      position: { x: baseX, y: finalY },
      size: { width: nodeWidth, height: nodeHeight },
      connections: [],
      parentId,
      mindMapMetadata: {
        level,
        collapsed: false,
        order,
        layoutType: 'horizontal'
      }
    });

    // 递归创建孙节点
    if (child.children && child.children.length > 0) {
      await createChildNodes(
        childId,
        child.children,
        level + 1,
        0,
        baseX,
        finalY,
        addNode,
        getAllNodes
      );
    }
  }
}
