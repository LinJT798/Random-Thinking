// 节点类型定义
export type NodeType = 'text' | 'sticky' | 'ai-generated';

// AI 来源类型
export type AISource = 'user' | 'ai-expanded' | 'ai-summarized';

// 节点位置
export interface Position {
  x: number;
  y: number;
}

// 节点尺寸
export interface Size {
  width: number;
  height: number;
}

// AI 元数据
export interface AIMetadata {
  source: AISource;
  prompt?: string;
  timestamp: number;
  originalNodeId?: string; // 如果是AI生成的，关联原始节点
}

// 节点数据结构
export interface CanvasNode {
  id: string;
  type: NodeType;
  content: string;
  position: Position;
  size: Size;
  connections: string[]; // 连接到其他节点的ID
  aiMetadata?: AIMetadata;
  createdAt: number;
  updatedAt: number;
  color?: string; // 便签颜色
}

// 画布数据结构
export interface CanvasData {
  id: string;
  name: string;
  nodes: CanvasNode[];
  createdAt: number;
  updatedAt: number;
}

// AI 请求类型
export interface AIRequest {
  nodeId: string;
  content: string;
  action: 'expand' | 'summarize';
}

// AI 响应类型
export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}
