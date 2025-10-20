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
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  currentCanvas: null,
  currentCanvasId: null,
  nodes: [],
  selectedNodeIds: [],
  loading: false,
  aiProcessing: false,

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
    const { currentCanvasId, nodes } = get();
    if (!currentCanvasId) {
      throw new Error('No canvas selected');
    }

    const nodeId = await db.addNode(currentCanvasId, node);
    const newNode = await db.nodes.get(nodeId);

    if (newNode) {
      set({ nodes: [...nodes, newNode] });
    }

    return nodeId;
  },

  updateNode: async (nodeId, updates) => {
    await db.updateNode(nodeId, updates);

    const { nodes } = get();
    set({
      nodes: nodes.map(node =>
        node.id === nodeId
          ? { ...node, ...updates, updatedAt: Date.now() }
          : node
      )
    });
  },

  deleteNode: async (nodeId) => {
    const { currentCanvasId, nodes, selectedNodeIds } = get();
    if (!currentCanvasId) return;

    await db.deleteNode(currentCanvasId, nodeId);

    set({
      nodes: nodes.filter(node => node.id !== nodeId),
      selectedNodeIds: selectedNodeIds.filter(id => id !== nodeId)
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
}));
