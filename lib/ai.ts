import type { AIRequest, AIResponse } from '@/types';

// 客户端 AI 功能封装

/**
 * 扩写内容
 */
export async function expandContent(nodeId: string, content: string): Promise<AIResponse> {
  try {
    const request: AIRequest = {
      nodeId,
      content,
      action: 'expand'
    };

    const response = await fetch('/api/ai/expand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data: AIResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to expand content');
    }

    return data;
  } catch (error) {
    console.error('Error expanding content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 总结内容
 */
export async function summarizeContent(nodeId: string, content: string): Promise<AIResponse> {
  try {
    const request: AIRequest = {
      nodeId,
      content,
      action: 'summarize'
    };

    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data: AIResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to summarize content');
    }

    return data;
  } catch (error) {
    console.error('Error summarizing content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 检查内容是否应该被总结（超过500字）
 */
export function shouldSuggestSummary(content: string): boolean {
  return content.length > 500;
}

/**
 * 检查是否有很多未连接的节点（>10个）
 */
export function shouldSuggestOrganize(nodes: any[]): boolean {
  const unconnectedNodes = nodes.filter(node =>
    !node.connections || node.connections.length === 0
  );
  return unconnectedNodes.length > 10;
}

/**
 * 计算两个节点之间的距离
 */
export function calculateDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检查两个节点是否应该建议连接（距离很近但未连接）
 */
export function shouldSuggestConnection(
  node1: any,
  node2: any,
  threshold: number = 200
): boolean {
  // 如果已经连接，返回false
  if (node1.connections?.includes(node2.id) || node2.connections?.includes(node1.id)) {
    return false;
  }

  // 计算距离
  const distance = calculateDistance(node1.position, node2.position);
  return distance < threshold;
}
