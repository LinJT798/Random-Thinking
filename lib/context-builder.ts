import type { CanvasNode, NodeChanges } from '@/types';

/**
 * 格式化节点内容为可读的文本
 */
export function formatNodesForContext(nodes: CanvasNode[]): string {
  if (nodes.length === 0) {
    return '（画布为空）';
  }

  const sections: string[] = [];

  // 按类型分组
  const textNodes = nodes.filter(n => n.type === 'text' || n.type === 'ai-generated');
  const stickyNotes = nodes.filter(n => n.type === 'sticky');
  const mindMapNodes = nodes.filter(n => n.type === 'mindmap');

  // 文本卡片
  if (textNodes.length > 0) {
    sections.push('【文本卡片】');
    textNodes.forEach((node, index) => {
      const content = node.content.trim() || '（空白）';
      sections.push(`${index + 1}. ${content}`);
    });
  }

  // 便签
  if (stickyNotes.length > 0) {
    sections.push('\n【便签】');
    stickyNotes.forEach((node, index) => {
      const content = node.content.trim() || '（空白）';
      const color = node.color ? `[${node.color}]` : '';
      sections.push(`${index + 1}. ${color} ${content}`);
    });
  }

  // 思维导图（按层级组织）
  if (mindMapNodes.length > 0) {
    sections.push('\n【思维导图】');
    const rootNodes = mindMapNodes.filter(n => !n.parentId);

    rootNodes.forEach(rootNode => {
      sections.push(formatMindMapTree(rootNode, mindMapNodes, 0));
    });
  }

  return sections.join('\n');
}

/**
 * 递归格式化思维导图树
 */
function formatMindMapTree(node: CanvasNode, allNodes: CanvasNode[], depth: number): string {
  const indent = '  '.repeat(depth);
  const content = node.content.trim() || '（空白）';
  const collapsed = node.mindMapMetadata?.collapsed ? ' [已折叠]' : '';

  let result = `${indent}- ${content}${collapsed}`;

  // 获取子节点
  if (node.childrenIds && node.childrenIds.length > 0 && !node.mindMapMetadata?.collapsed) {
    const children = allNodes.filter(n => node.childrenIds?.includes(n.id));
    const sortedChildren = children.sort((a, b) =>
      (a.mindMapMetadata?.order || 0) - (b.mindMapMetadata?.order || 0)
    );

    sortedChildren.forEach(child => {
      result += '\n' + formatMindMapTree(child, allNodes, depth + 1);
    });
  }

  return result;
}

/**
 * 构建初始画布上下文
 */
export function buildInitialContext(nodes: CanvasNode[]): string {
  if (nodes.length === 0) {
    return '画布当前为空，还没有任何内容。';
  }

  return `画布当前内容：\n\n${formatNodesForContext(nodes)}`;
}

/**
 * 检测节点变化
 */
export function detectNodeChanges(
  currentNodes: CanvasNode[],
  initialNodeIds: string[],
  chatStartTimestamp: number
): NodeChanges {
  const currentNodeIds = new Set(currentNodes.map(n => n.id));
  const initialNodeIdSet = new Set(initialNodeIds);

  // 新增的节点
  const newNodes = currentNodes.filter(
    n => n.createdAt > chatStartTimestamp
  );

  // 修改的节点（在初始快照中，且更新时间晚于聊天开始）
  const modifiedNodes = currentNodes.filter(
    n => initialNodeIdSet.has(n.id) &&
         n.updatedAt > chatStartTimestamp &&
         n.createdAt <= chatStartTimestamp  // 确保不是新增的
  );

  // 删除的节点（在初始快照中但当前不存在）
  const deletedNodeIds = initialNodeIds.filter(
    id => !currentNodeIds.has(id)
  );

  return {
    newNodes,
    modifiedNodes,
    deletedNodeIds
  };
}

/**
 * 构建增量上下文描述
 */
export function buildIncrementalContext(changes: NodeChanges): string | null {
  const parts: string[] = [];

  // 修改的节点
  if (changes.modifiedNodes.length > 0) {
    parts.push('【修改的内容】');
    changes.modifiedNodes.forEach((node, index) => {
      const typeLabel = getNodeTypeLabel(node.type);
      const content = node.content.trim() || '（空白）';
      parts.push(`${index + 1}. ${typeLabel}：${content}`);
    });
  }

  // 删除的节点
  if (changes.deletedNodeIds.length > 0) {
    parts.push('\n【删除的内容】');
    parts.push(`删除了 ${changes.deletedNodeIds.length} 个节点`);
  }

  // 新增的节点
  if (changes.newNodes.length > 0) {
    parts.push('\n【新增的内容】');
    changes.newNodes.forEach((node, index) => {
      const typeLabel = getNodeTypeLabel(node.type);
      const content = node.content.trim() || '（空白）';
      parts.push(`${index + 1}. ${typeLabel}：${content}`);
    });
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * 获取节点类型标签
 */
function getNodeTypeLabel(type: string): string {
  switch (type) {
    case 'text':
    case 'ai-generated':
      return '文本卡片';
    case 'sticky':
      return '便签';
    case 'mindmap':
      return '思维导图节点';
    default:
      return '节点';
  }
}
