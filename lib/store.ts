import { create } from 'zustand';
import type { CanvasNode, CanvasData, LayoutType, ChatMessage, ChatReference } from '@/types';
import { db } from './db';
import { calculateMindMapLayout, getAllDescendantIds } from './mindmap-layout';

interface CanvasStore {
  // 当前画布
  currentCanvas: CanvasData | null;
  currentCanvasId: string | null;

  // 节点列表
  nodes: CanvasNode[];

  // 选中的节点
  selectedNodeIds: string[];

  // 加载状态
  loading: boolean;

  // AI 处理状态
  aiProcessing: boolean;

  // 历史记录
  history: CanvasNode[][];
  future: CanvasNode[][];

  // Actions
  setCurrentCanvas: (canvas: CanvasData) => void;
  loadCanvas: (canvasId: string) => Promise<void>;
  createNewCanvas: (name?: string) => Promise<string>;

  addNode: (node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNode: (nodeId: string, updates: Partial<CanvasNode>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;

  selectNode: (nodeId: string) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;

  setAIProcessing: (processing: boolean) => void;

  undo: () => void;
  redo: () => void;

  // 思维导图方法
  addChildNode: (parentId: string, content: string) => Promise<string>;
  toggleNodeCollapse: (nodeId: string) => Promise<void>;
  applyAutoLayout: (rootNodeId: string, layoutType?: LayoutType) => Promise<void>;

  // 聊天相关状态
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  chatWindowPosition: { x: number; y: number };
  chatWindowSize: { width: number; height: number };
  chatStartTimestamp: number | null;
  initialNodeSnapshot: string[] | null;
  chatReferences: ChatReference[];

  // 聊天方法
  openChat: () => Promise<void>;
  closeChat: () => void;
  toggleChat: () => Promise<void>;
  sendChatMessage: (content: string) => Promise<void>;
  addChatMessage: (role: 'user' | 'assistant', content: string, references?: ChatReference[]) => Promise<void>;
  loadChatHistory: () => Promise<void>;
  clearChatHistory: () => Promise<void>;
  setChatWindowPosition: (position: { x: number; y: number }) => void;
  setChatWindowSize: (size: { width: number; height: number }) => void;
  addChatReference: (nodeId: string, content: string) => void;
  removeChatReference: (referenceId: string) => void;
  clearChatReferences: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  currentCanvas: null,
  currentCanvasId: null,
  nodes: [],
  selectedNodeIds: [],
  loading: false,
  aiProcessing: false,
  history: [],
  future: [],

  // 聊天初始状态
  chatMessages: [],
  isChatOpen: false,
  chatWindowPosition: { x: typeof window !== 'undefined' ? window.innerWidth - 450 : 800, y: 50 },
  chatWindowSize: { width: 400, height: 600 },
  chatStartTimestamp: null,
  initialNodeSnapshot: null,
  chatReferences: [],

  setCurrentCanvas: (canvas) => set({ currentCanvas: canvas, currentCanvasId: canvas.id }),

  loadCanvas: async (canvasId) => {
    set({ loading: true });
    try {
      const canvas = await db.getCanvas(canvasId);
      if (canvas) {
        const nodes = await db.getCanvasNodes(canvasId);
        set({
          currentCanvas: canvas,
          currentCanvasId: canvasId,
          nodes,
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to load canvas:', error);
      set({ loading: false });
    }
  },

  createNewCanvas: async (name) => {
    const canvasId = await db.createCanvas(name);
    const canvas = await db.getCanvas(canvasId);
    if (canvas) {
      set({
        currentCanvas: canvas,
        currentCanvasId: canvasId,
        nodes: []
      });
    }
    return canvasId;
  },

  addNode: async (node) => {
    const { currentCanvasId, nodes, history } = get();
    if (!currentCanvasId) {
      throw new Error('No canvas selected');
    }

    const nodeId = await db.addNode(currentCanvasId, node);
    const newNode = await db.nodes.get(nodeId);

    if (newNode) {
      // 保存历史记录
      set({
        nodes: [...nodes, newNode],
        history: [...history, nodes],
        future: [] // 清空重做历史
      });
    }

    return nodeId;
  },

  updateNode: async (nodeId, updates) => {
    await db.updateNode(nodeId, updates);

    const { nodes, history } = get();
    const updatedNodes = nodes.map(node =>
      node.id === nodeId
        ? { ...node, ...updates, updatedAt: Date.now() }
        : node
    );

    set({
      nodes: updatedNodes,
      history: [...history, nodes],
      future: [] // 清空重做历史
    });
  },

  deleteNode: async (nodeId) => {
    const { currentCanvasId, nodes, selectedNodeIds, history } = get();
    if (!currentCanvasId) return;

    await db.deleteNode(currentCanvasId, nodeId);

    set({
      nodes: nodes.filter(node => node.id !== nodeId),
      selectedNodeIds: selectedNodeIds.filter(id => id !== nodeId),
      history: [...history, nodes],
      future: [] // 清空重做历史
    });
  },

  selectNode: (nodeId) => {
    // 单选模式：每次点击只选中当前节点
    set({ selectedNodeIds: [nodeId] });
  },

  deselectNode: (nodeId) => {
    const { selectedNodeIds } = get();
    set({ selectedNodeIds: selectedNodeIds.filter(id => id !== nodeId) });
  },

  clearSelection: () => set({ selectedNodeIds: [] }),

  setAIProcessing: (processing) => set({ aiProcessing: processing }),

  undo: () => {
    const { history, nodes, future } = get();
    if (history.length === 0) return;

    const previousNodes = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    set({
      nodes: previousNodes,
      history: newHistory,
      future: [nodes, ...future]
    });

    // 同步到数据库
    const { currentCanvasId } = get();
    if (currentCanvasId) {
      // 这里简化处理，实际应该差异更新
      previousNodes.forEach(node => db.updateNode(node.id, node));
    }
  },

  redo: () => {
    const { future, nodes, history } = get();
    if (future.length === 0) return;

    const nextNodes = future[0];
    const newFuture = future.slice(1);

    set({
      nodes: nextNodes,
      history: [...history, nodes],
      future: newFuture
    });

    // 同步到数据库
    const { currentCanvasId } = get();
    if (currentCanvasId) {
      nextNodes.forEach(node => db.updateNode(node.id, node));
    }
  },

  // 添加子节点
  addChildNode: async (parentId, content) => {
    const { currentCanvasId, nodes, history } = get();
    if (!currentCanvasId) {
      throw new Error('No canvas selected');
    }

    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) {
      throw new Error('Parent node not found');
    }

    // 计算子节点的层级和顺序
    const parentLevel = parentNode.mindMapMetadata?.level || 0;
    const existingChildren = parentNode.childrenIds || [];
    const layoutType = parentNode.mindMapMetadata?.layoutType || 'horizontal';

    // 计算新节点的初始位置
    const newPosition = {
      x: parentNode.position.x + parentNode.size.width + 200,
      y: parentNode.position.y + (existingChildren.length * 100),
    };

    // 创建新节点
    const newNode: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'mindmap',
      content,
      position: newPosition,
      size: { width: 150, height: 60 },
      connections: [],
      parentId: parentId,
      childrenIds: [],
      mindMapMetadata: {
        level: parentLevel + 1,
        collapsed: false,
        order: existingChildren.length,
        layoutType,
      },
    };

    const nodeId = await db.addNode(currentCanvasId, newNode);
    const createdNode = await db.nodes.get(nodeId);

    if (createdNode) {
      // 更新父节点的 childrenIds
      const updatedParent = {
        ...parentNode,
        childrenIds: [...existingChildren, nodeId],
      };

      await db.updateNode(parentId, { childrenIds: updatedParent.childrenIds });

      // 更新 store
      set({
        nodes: [
          ...nodes.filter(n => n.id !== parentId),
          updatedParent,
          createdNode,
        ],
        history: [...history, nodes],
        future: [],
      });
    }

    return nodeId;
  },

  // 切换节点折叠状态
  toggleNodeCollapse: async (nodeId) => {
    const { nodes, history } = get();
    const node = nodes.find(n => n.id === nodeId);

    if (!node || !node.mindMapMetadata) return;

    const newCollapsed = !node.mindMapMetadata.collapsed;

    await db.updateNode(nodeId, {
      mindMapMetadata: {
        ...node.mindMapMetadata,
        collapsed: newCollapsed,
      },
    });

    set({
      nodes: nodes.map(n =>
        n.id === nodeId && n.mindMapMetadata
          ? {
              ...n,
              mindMapMetadata: {
                ...n.mindMapMetadata,
                collapsed: newCollapsed,
              },
            }
          : n
      ),
      history: [...history, nodes],
      future: [],
    });
  },

  // 应用自动布局
  applyAutoLayout: async (rootNodeId, layoutType = 'horizontal') => {
    const { nodes, history } = get();

    // 计算新的布局位置
    const newPositions = calculateMindMapLayout(nodes, rootNodeId, layoutType);

    if (newPositions.size === 0) return;

    // 批量更新节点位置
    const updatedNodes = nodes.map(node => {
      const newPosition = newPositions.get(node.id);
      if (newPosition) {
        db.updateNode(node.id, { position: newPosition });
        return { ...node, position: newPosition };
      }
      return node;
    });

    set({
      nodes: updatedNodes,
      history: [...history, nodes],
      future: [],
    });
  },

  // 打开聊天窗口
  openChat: async () => {
    const { currentCanvasId, nodes } = get();
    if (!currentCanvasId) return;

    // 记录快照和时间戳
    const timestamp = Date.now();
    const nodeIds = nodes.map(n => n.id);

    // 加载历史消息
    const history = await db.getChatHistory(currentCanvasId);

    set({
      isChatOpen: true,
      chatStartTimestamp: timestamp,
      initialNodeSnapshot: nodeIds,
      chatMessages: history,
    });
  },

  // 关闭聊天窗口
  closeChat: () => {
    set({ isChatOpen: false });
  },

  // 切换聊天窗口
  toggleChat: async () => {
    const { isChatOpen, openChat, closeChat } = get();
    if (isChatOpen) {
      closeChat();
    } else {
      await openChat();
    }
  },

  // 发送聊天消息
  sendChatMessage: async (content: string) => {
    const { currentCanvasId, addChatMessage } = get();
    if (!currentCanvasId || !content.trim()) return;

    try {
      // 添加用户消息到本地和数据库
      await addChatMessage('user', content);

      // 调用 API 发送消息（这里简化处理，实际应该在组件中处理流式响应）
      // API 调用会在 ChatWindow 组件中处理
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  },

  // 添加聊天消息
  addChatMessage: async (role: 'user' | 'assistant', content: string, references?: ChatReference[]) => {
    const { currentCanvasId, chatMessages } = get();
    if (!currentCanvasId) return;

    // 保存到数据库（注意：db 层不存储 references，因为它们是临时的）
    const messageId = await db.addChatMessage(currentCanvasId, role, content);

    // 更新本地状态
    const newMessage: ChatMessage = {
      id: messageId,
      canvasId: currentCanvasId,
      role,
      content,
      timestamp: Date.now(),
      references: references, // 添加引用内容
    };

    set({
      chatMessages: [...chatMessages, newMessage],
    });
  },

  // 加载聊天历史
  loadChatHistory: async () => {
    const { currentCanvasId } = get();
    if (!currentCanvasId) return;

    const history = await db.getChatHistory(currentCanvasId);
    set({ chatMessages: history });
  },

  // 清空聊天历史
  clearChatHistory: async () => {
    const { currentCanvasId } = get();
    if (!currentCanvasId) return;

    await db.clearChatHistory(currentCanvasId);
    set({
      chatMessages: [],
      chatStartTimestamp: Date.now(),
      initialNodeSnapshot: get().nodes.map(n => n.id),
    });
  },

  // 设置聊天窗口位置
  setChatWindowPosition: (position) => {
    set({ chatWindowPosition: position });
  },

  // 设置聊天窗口大小
  setChatWindowSize: (size) => {
    set({ chatWindowSize: size });
  },

  // 添加聊天引用
  addChatReference: (nodeId, content) => {
    const { chatReferences } = get();

    // 检查是否已经引用了这个节点
    if (chatReferences.some(ref => ref.nodeId === nodeId)) {
      return;
    }

    const newReference: ChatReference = {
      id: crypto.randomUUID(),
      nodeId,
      content,
      timestamp: Date.now(),
    };

    set({
      chatReferences: [...chatReferences, newReference],
    });
  },

  // 移除聊天引用
  removeChatReference: (referenceId) => {
    const { chatReferences } = get();
    set({
      chatReferences: chatReferences.filter(ref => ref.id !== referenceId),
    });
  },

  // 清空所有引用
  clearChatReferences: () => {
    set({ chatReferences: [] });
  },
}));
