import type { CanvasNode, Position, LayoutType } from '@/types';

// 布局配置
const LAYOUT_CONFIG = {
  horizontal: {
    levelSpacing: 200,  // 层级之间的水平间距
    nodeSpacing: 80,    // 同级节点之间的垂直间距
  },
  vertical: {
    levelSpacing: 150,  // 层级之间的垂直间距
    nodeSpacing: 100,   // 同级节点之间的水平间距
  },
};

// 构建节点树结构
interface TreeNode {
  node: CanvasNode;
  children: TreeNode[];
}

function buildTree(nodes: CanvasNode[], rootId: string): TreeNode | null {
  const nodeMap = new Map<string, CanvasNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const root = nodeMap.get(rootId);
  if (!root) return null;

  function buildSubtree(nodeId: string): TreeNode {
    const node = nodeMap.get(nodeId)!;
    const children: TreeNode[] = [];

    if (node.childrenIds) {
      // 按照 order 排序
      const sortedChildren = [...node.childrenIds]
        .map(id => nodeMap.get(id))
        .filter((n): n is CanvasNode => !!n)
        .sort((a, b) => {
          const orderA = a.mindMapMetadata?.order || 0;
          const orderB = b.mindMapMetadata?.order || 0;
          return orderA - orderB;
        });

      children.push(...sortedChildren.map(child => buildSubtree(child.id)));
    }

    return { node, children };
  }

  return buildSubtree(rootId);
}

// 计算子树的高度/宽度
function calculateSubtreeSize(
  tree: TreeNode,
  layoutType: LayoutType
): { width: number; height: number } {
  if (tree.children.length === 0) {
    return {
      width: tree.node.size.width,
      height: tree.node.size.height,
    };
  }

  const childSizes = tree.children.map(child =>
    calculateSubtreeSize(child, layoutType)
  );

  if (layoutType === 'horizontal') {
    // 水平布局：子节点垂直排列
    const totalHeight = childSizes.reduce((sum, size) =>
      sum + size.height + LAYOUT_CONFIG.horizontal.nodeSpacing,
      0
    ) - LAYOUT_CONFIG.horizontal.nodeSpacing;

    return {
      width: tree.node.size.width + LAYOUT_CONFIG.horizontal.levelSpacing +
             Math.max(...childSizes.map(s => s.width)),
      height: Math.max(tree.node.size.height, totalHeight),
    };
  } else {
    // 垂直布局：子节点水平排列
    const totalWidth = childSizes.reduce((sum, size) =>
      sum + size.width + LAYOUT_CONFIG.vertical.nodeSpacing,
      0
    ) - LAYOUT_CONFIG.vertical.nodeSpacing;

    return {
      width: Math.max(tree.node.size.width, totalWidth),
      height: tree.node.size.height + LAYOUT_CONFIG.vertical.levelSpacing +
              Math.max(...childSizes.map(s => s.height)),
    };
  }
}

// 应用布局位置
function applyLayout(
  tree: TreeNode,
  layoutType: LayoutType,
  basePosition: Position,
  nodePositions: Map<string, Position>
) {
  // 设置当前节点位置
  nodePositions.set(tree.node.id, { ...basePosition });

  if (tree.children.length === 0) return;

  const config = layoutType === 'horizontal'
    ? LAYOUT_CONFIG.horizontal
    : LAYOUT_CONFIG.vertical;

  if (layoutType === 'horizontal') {
    // 水平布局：子节点在右侧垂直排列
    const childSizes = tree.children.map(child =>
      calculateSubtreeSize(child, layoutType)
    );
    const totalHeight = childSizes.reduce((sum, size) =>
      sum + size.height + config.nodeSpacing,
      0
    ) - config.nodeSpacing;

    let currentY = basePosition.y - totalHeight / 2;

    tree.children.forEach((child, index) => {
      const childSize = childSizes[index];
      const childX = basePosition.x + tree.node.size.width + config.levelSpacing;
      const childY = currentY + childSize.height / 2;

      applyLayout(
        child,
        layoutType,
        { x: childX, y: childY },
        nodePositions
      );

      currentY += childSize.height + config.nodeSpacing;
    });
  } else {
    // 垂直布局：子节点在下方水平排列
    const childSizes = tree.children.map(child =>
      calculateSubtreeSize(child, layoutType)
    );
    const totalWidth = childSizes.reduce((sum, size) =>
      sum + size.width + config.nodeSpacing,
      0
    ) - config.nodeSpacing;

    let currentX = basePosition.x - totalWidth / 2;

    tree.children.forEach((child, index) => {
      const childSize = childSizes[index];
      const childX = currentX + childSize.width / 2;
      const childY = basePosition.y + tree.node.size.height + config.levelSpacing;

      applyLayout(
        child,
        layoutType,
        { x: childX, y: childY },
        nodePositions
      );

      currentX += childSize.width + config.nodeSpacing;
    });
  }
}

/**
 * 计算思维导图的自动布局
 * @param nodes 所有节点
 * @param rootNodeId 根节点ID
 * @param layoutType 布局类型
 * @returns 节点ID到新位置的映射
 */
export function calculateMindMapLayout(
  nodes: CanvasNode[],
  rootNodeId: string,
  layoutType: LayoutType = 'horizontal'
): Map<string, Position> {
  const tree = buildTree(nodes, rootNodeId);
  if (!tree) return new Map();

  const nodePositions = new Map<string, Position>();

  // 从根节点的当前位置开始布局
  const rootNode = nodes.find(n => n.id === rootNodeId);
  const startPosition = rootNode
    ? { ...rootNode.position }
    : { x: 100, y: 100 };

  applyLayout(tree, layoutType, startPosition, nodePositions);

  return nodePositions;
}

/**
 * 获取所有后代节点ID
 * @param nodes 所有节点
 * @param rootNodeId 根节点ID
 * @returns 后代节点ID数组（包括根节点）
 */
export function getAllDescendantIds(
  nodes: CanvasNode[],
  rootNodeId: string
): string[] {
  const nodeMap = new Map<string, CanvasNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const descendants: string[] = [rootNodeId];
  const queue = [rootNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId);

    if (currentNode?.childrenIds) {
      currentNode.childrenIds.forEach(childId => {
        descendants.push(childId);
        queue.push(childId);
      });
    }
  }

  return descendants;
}
