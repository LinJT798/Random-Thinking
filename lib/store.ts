import { create } from 'zustand';
import type { CanvasNode, CanvasData } from '@/types';
import { db } from './db';

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
    const { selectedNodeIds } = get();
    if (!selectedNodeIds.includes(nodeId)) {
      set({ selectedNodeIds: [...selectedNodeIds, nodeId] });
    }
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
}));
