// 节点类型定义
export type NodeType = 'text' | 'sticky' | 'ai-generated' | 'mindmap';

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

// 思维导图布局类型
export type LayoutType = 'vertical' | 'horizontal';

// 思维导图元数据
export interface MindMapMetadata {
  level: number;           // 层级（0=根节点，1=一级子节点...）
  collapsed: boolean;      // 是否折叠
  order: number;           // 同级排序
  layoutType: LayoutType;  // 布局方向
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
  // 思维导图相关
  parentId?: string;      // 父节点ID
  childrenIds?: string[]; // 子节点ID列表
  mindMapMetadata?: MindMapMetadata; // 思维导图元数据
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

// 聊天相关类型
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  canvasId: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  references?: ChatReference[]; // 引用内容（仅用户消息）
}

// 画布快照类型
export interface CanvasSnapshot {
  nodeIds: string[];
  timestamp: number;
}

// 节点变化类型
export interface NodeChanges {
  newNodes: CanvasNode[];
  modifiedNodes: CanvasNode[];
  deletedNodeIds: string[];
}

// 聊天引用内容类型
export interface ChatReference {
  id: string;
  nodeId: string;
  content: string;
  timestamp: number;
}
