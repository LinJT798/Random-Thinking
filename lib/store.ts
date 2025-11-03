import { create } from 'zustand';
import type { CanvasNode, CanvasData, LayoutType, ChatMessage, ChatReference, ChatSession, ToolCallInfo } from '@/types';
import { db } from './db';
import { calculateMindMapLayout, getAllDescendantIds } from './mindmap-layout';
import { generateUUID } from './uuid';

// 延迟导入 syncManager 避免循环依赖
let syncManager: { debouncedSyncCanvas: (canvasId: string) => void; immediateSyncCanvas: (canvasId: string) => Promise<void> } | null = null;
if (typeof window !== 'undefined') {
  import('./sync-manager').then(module => {
    syncManager = module.syncManager;
  });
}

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

  // 聊天相关状态 - 多会话支持
  chatSessions: ChatSession[];
  currentChatId: string | null;
  chatListExpanded: boolean; // 聊天列表是否展开

  // 分屏模式状态
  dockedChatId: string | null; // 固定在左侧的聊天窗口ID
  dockedWidth: number; // 固定窗口宽度百分比（30-50）

  // 拖拽文本状态
  draggingText: string | null;
  setDraggingText: (text: string | null) => void;

  // 聊天方法
  createChatSession: () => string;
  openChatSession: (chatId: string) => Promise<void>;
  closeChatSession: (chatId: string) => Promise<void>;
  toggleChatList: () => void;
  switchChat: (chatId: string) => void;
  deleteChatSession: (chatId: string) => Promise<void>;

  sendChatMessage: (chatId: string, content: string) => Promise<void>;
  addChatMessage: (chatId: string, role: 'user' | 'assistant' | 'tool', content: string, references?: ChatReference[], toolCalls?: ToolCallInfo[], tool_call_id?: string) => Promise<void>;
  confirmToolCall: (chatId: string, messageId: string, toolIndex: number) => Promise<void>;
  rejectToolCall: (chatId: string, messageId: string, toolIndex: number) => Promise<void>;
  loadChatHistory: (chatId: string) => Promise<void>;
  clearChatHistory: (chatId: string) => Promise<void>;

  setChatWindowPosition: (chatId: string, position: { x: number; y: number }) => void;
  setChatWindowSize: (chatId: string, size: { width: number; height: number }) => void;
  updateChatName: (chatId: string, name: string) => void;

  addChatReference: (chatId: string, nodeId: string, content: string) => void;
  removeChatReference: (chatId: string, referenceId: string) => void;
  clearChatReferences: (chatId: string) => void;

  // 分屏模式方法
  setDockedChat: (chatId: string | null) => void;
  setDockedWidth: (width: number) => void;
  toggleDockedChat: (chatId: string) => void;
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

  // 聊天初始状态 - 多会话
  chatSessions: [],
  currentChatId: null,
  chatListExpanded: false,

  // 分屏模式初始状态
  dockedChatId: null,
  dockedWidth: 30, // 默认30%

  // 拖拽文本初始状态
  draggingText: null,

  setCurrentCanvas: (canvas) => set({ currentCanvas: canvas, currentCanvasId: canvas.id }),

  loadCanvas: async (canvasId) => {
    set({ loading: true });
    try {
      const canvas = await db.getCanvas(canvasId);
      if (canvas) {
        const nodes = await db.getCanvasNodes(canvasId);
        let chatSessions = await db.getChatSessions(canvasId);

        // 从 localStorage 恢复分屏状态
        let dockedChatId = null;
        let dockedWidth = 30;
        if (typeof window !== 'undefined') {
          const savedState = localStorage.getItem(`canvas_${canvasId}_docked_state`);
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState);
              dockedChatId = parsed.dockedChatId;
              dockedWidth = parsed.dockedWidth || 30;
              console.log(`恢复画布 ${canvasId} 的分屏状态:`, { dockedChatId, dockedWidth });
            } catch (e) {
              console.warn('Failed to parse docked state:', e);
            }
          }
        }

        // 如果恢复了分屏状态，确保对应的聊天会话是打开的
        if (dockedChatId) {
          const dockedSession = chatSessions.find(s => s.id === dockedChatId);
          if (dockedSession && !dockedSession.isOpen) {
            console.log(`设置分屏聊天会话 ${dockedChatId} 为打开状态`);
            chatSessions = chatSessions.map(s =>
              s.id === dockedChatId ? { ...s, isOpen: true } : s
            );
            // 同步更新到数据库
            await db.updateChatSession({ ...dockedSession, isOpen: true });
          }
        }

        set({
          currentCanvas: canvas,
          currentCanvasId: canvasId,
          nodes,
          chatSessions,
          dockedChatId,
          dockedWidth,
          loading: false
        });

        // 保存为最后使用的画布
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_canvas_id', canvasId);
          console.log(`💾 保存最后使用的画布: ${canvasId}`);
        }
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

      // 创建画布 - 立即同步（重要操作）
      if (syncManager) {
        syncManager.immediateSyncCanvas(canvasId);
      }
    }
    return canvasId;
  },

  addNode: async (node) => {
    const { currentCanvasId, nodes, history } = get();
    if (!currentCanvasId) {
      console.error('❌ No canvas selected');
      throw new Error('No canvas selected');
    }

    console.log(`Adding node to canvas ${currentCanvasId}...`);

    try {
      const nodeId = await db.addNode(currentCanvasId, node);
      console.log(`✅ Node saved to IndexedDB with ID: ${nodeId}`);

      const newNode = await db.nodes.get(nodeId);
      console.log('Retrieved node from DB:', newNode ? '✅ Found' : '❌ Not found');

      if (newNode) {
        // 保存历史记录
        set({
          nodes: [...nodes, newNode],
          history: [...history, nodes],
          future: [] // 清空重做历史
        });
        console.log(`✅ Node added to store. Total nodes: ${nodes.length + 1}`);

        // 创建节点 - 立即同步（重要操作）
        if (syncManager) {
          syncManager.immediateSyncCanvas(currentCanvasId);
        }
      } else {
        console.error('❌ Failed to retrieve node from DB after creation');
      }

      return nodeId;
    } catch (error) {
      console.error('❌ Error in addNode:', error);
      throw error;
    }
  },

  updateNode: async (nodeId, updates) => {
    const { currentCanvasId } = get();
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

    // 触发防抖同步
    if (syncManager && currentCanvasId) {
      syncManager.debouncedSyncCanvas(currentCanvasId);
    }
  },

  deleteNode: async (nodeId) => {
    const { currentCanvasId, nodes, selectedNodeIds, history } = get();
    if (!currentCanvasId) return;

    // 收集所有要删除的节点（包括子节点）
    const nodesToDelete = getAllDescendantIds(nodes, nodeId);
    nodesToDelete.push(nodeId); // 包含自己

    console.log(`Deleting ${nodesToDelete.length} nodes (including descendants)`);

    await db.deleteNode(currentCanvasId, nodeId);

    set({
      nodes: nodes.filter(node => !nodesToDelete.includes(node.id)),
      selectedNodeIds: selectedNodeIds.filter(id => !nodesToDelete.includes(id)),
      history: [...history, nodes],
      future: [] // 清空重做历史
    });

    // 删除节点 - 立即同步（破坏性操作，必须立即保存）
    if (syncManager && currentCanvasId) {
      syncManager.immediateSyncCanvas(currentCanvasId);
    }
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

      // 创建子节点 - 立即同步（创建操作）
      if (syncManager && currentCanvasId) {
        syncManager.immediateSyncCanvas(currentCanvasId);
      }
    }

    return nodeId;
  },

  // 切换节点折叠状态
  toggleNodeCollapse: async (nodeId) => {
    const { currentCanvasId, nodes, history } = get();
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

    // 触发防抖同步
    if (syncManager && currentCanvasId) {
      syncManager.debouncedSyncCanvas(currentCanvasId);
    }
  },

  // 应用自动布局
  applyAutoLayout: async (rootNodeId, layoutType = 'horizontal') => {
    const { currentCanvasId, nodes, history } = get();

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

    // 触发防抖同步
    if (syncManager && currentCanvasId) {
      syncManager.debouncedSyncCanvas(currentCanvasId);
    }
  },

  // 创建新的聊天会话
  createChatSession: () => {
    const { currentCanvasId, nodes, chatSessions } = get();
    if (!currentCanvasId) return '';

    const chatId = generateUUID();
    const timestamp = Date.now();
    const sessionNumber = chatSessions.length + 1;

    const newSession: ChatSession = {
      id: chatId,
      canvasId: currentCanvasId,
      name: `Chat ${sessionNumber}`,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      isOpen: true,
      position: {
        x: typeof window !== 'undefined' ? window.innerWidth - 450 - (chatSessions.filter(s => s.isOpen).length * 50) : 800,
        y: 50 + (chatSessions.filter(s => s.isOpen).length * 50)
      },
      size: { width: 400, height: 600 },
      startTimestamp: timestamp,
      initialNodeSnapshot: nodes.map(n => n.id),
      references: [],
    };

    set({
      chatSessions: [...chatSessions, newSession],
      currentChatId: chatId,
    });

    // 保存到数据库
    db.createChatSession(newSession);

    return chatId;
  },

  // 打开聊天会话
  openChatSession: async (chatId) => {
    const { chatSessions } = get();
    const updatedSessions = chatSessions.map(session =>
      session.id === chatId ? { ...session, isOpen: true } : session
    );

    set({
      chatSessions: updatedSessions,
      currentChatId: chatId,
    });

    // 持久化到数据库
    const session = updatedSessions.find(s => s.id === chatId);
    if (session) {
      await db.updateChatSession(chatId, { isOpen: true });
    }
  },

  // 关闭聊天会话
  closeChatSession: async (chatId) => {
    const { chatSessions, currentChatId, dockedChatId, currentCanvasId } = get();
    const updatedSessions = chatSessions.map(session =>
      session.id === chatId ? { ...session, isOpen: false } : session
    );

    set({
      chatSessions: updatedSessions,
      currentChatId: currentChatId === chatId ? null : currentChatId,
      // 如果关闭的窗口处于分屏模式，退出分屏
      dockedChatId: dockedChatId === chatId ? null : dockedChatId,
    });

    // 持久化到数据库
    await db.updateChatSession(chatId, { isOpen: false });

    // 如果关闭的是分屏窗口，清除 localStorage 中的分屏状态
    if (dockedChatId === chatId && currentCanvasId && typeof window !== 'undefined') {
      localStorage.removeItem(`canvas_${currentCanvasId}_docked_state`);
    }
  },

  // 切换聊天列表展开状态
  toggleChatList: () => {
    set((state) => ({ chatListExpanded: !state.chatListExpanded }));
  },

  // 切换到指定聊天
  switchChat: (chatId) => {
    const { chatSessions } = get();
    const session = chatSessions.find(s => s.id === chatId);
    if (!session) return;

    if (!session.isOpen) {
      // 如果没打开，打开它
      set({
        chatSessions: chatSessions.map(s =>
          s.id === chatId ? { ...s, isOpen: true } : s
        ),
        currentChatId: chatId,
      });
    } else {
      // 如果已打开，只是切换当前激活
      set({ currentChatId: chatId });
    }
  },

  // 删除聊天会话
  deleteChatSession: async (chatId) => {
    const { currentCanvasId, chatSessions, currentChatId, dockedChatId } = get();

    // 从数据库删除
    await db.deleteChatSession(chatId);

    const newSessions = chatSessions.filter(s => s.id !== chatId);
    set({
      chatSessions: newSessions,
      currentChatId: currentChatId === chatId ? null : currentChatId,
      // 如果删除的窗口处于分屏模式，退出分屏
      dockedChatId: dockedChatId === chatId ? null : dockedChatId,
    });

    // 删除聊天 - 立即同步（删除操作）
    if (syncManager && currentCanvasId) {
      syncManager.immediateSyncCanvas(currentCanvasId);
    }
  },

  // 发送聊天消息
  sendChatMessage: async (chatId, content) => {
    const { addChatMessage } = get();
    if (!content.trim()) return;

    try {
      // 添加用户消息到本地和数据库
      await addChatMessage(chatId, 'user', content);
      // API 调用会在 ChatWindow 组件中处理
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  },

  // 添加聊天消息
  addChatMessage: async (chatId, role, content, references, toolCalls, tool_call_id) => {
    const { chatSessions, currentCanvasId } = get();
    if (!currentCanvasId) return;

    const session = chatSessions.find(s => s.id === chatId);
    if (!session) return;

    // 创建新消息
    const newMessage: ChatMessage = {
      id: generateUUID(),
      canvasId: currentCanvasId,
      role,
      content,
      timestamp: Date.now(),
      references,
      toolCalls,
      tool_call_id,
    };

    // 更新会话
    const updatedSession = {
      ...session,
      messages: [...session.messages, newMessage],
      updatedAt: Date.now(),
    };

    // 更新本地状态
    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? updatedSession : s
      ),
    });

    // 保存到数据库
    await db.updateChatSession(chatId, {
      messages: updatedSession.messages,
      updatedAt: updatedSession.updatedAt,
    });
  },

  // 确认工具调用
  confirmToolCall: async (chatId, messageId, toolIndex) => {
    const { chatSessions } = get();
    const session = chatSessions.find(s => s.id === chatId);
    if (!session) return;

    const updatedMessages = session.messages.map(msg => {
      if (msg.id === messageId && msg.toolCalls) {
        const updatedToolCalls = [...msg.toolCalls];
        if (updatedToolCalls[toolIndex]) {
          updatedToolCalls[toolIndex] = {
            ...updatedToolCalls[toolIndex],
            status: 'confirmed'
          };
        }
        return { ...msg, toolCalls: updatedToolCalls };
      }
      return msg;
    });

    const updatedSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? updatedSession : s
      )
    });

    // 持久化到数据库
    await db.updateChatSession(chatId, {
      messages: updatedSession.messages,
      updatedAt: updatedSession.updatedAt,
    });
  },

  // 拒绝工具调用
  rejectToolCall: async (chatId, messageId, toolIndex) => {
    const { chatSessions, deleteNode } = get();
    const session = chatSessions.find(s => s.id === chatId);
    if (!session) return;

    const message = session.messages.find(msg => msg.id === messageId);
    if (!message?.toolCalls || !message.toolCalls[toolIndex]) return;

    const toolCall = message.toolCalls[toolIndex];

    // 删除创建的节点
    for (const nodeId of toolCall.nodeIds) {
      await deleteNode(nodeId);
    }

    // 更新状态为 rejected
    const updatedMessages = session.messages.map(msg => {
      if (msg.id === messageId && msg.toolCalls) {
        const updatedToolCalls = [...msg.toolCalls];
        updatedToolCalls[toolIndex] = {
          ...updatedToolCalls[toolIndex],
          status: 'rejected'
        };
        return { ...msg, toolCalls: updatedToolCalls };
      }
      return msg;
    });

    const updatedSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? updatedSession : s
      )
    });

    // 持久化到数据库
    await db.updateChatSession(chatId, {
      messages: updatedSession.messages,
      updatedAt: updatedSession.updatedAt,
    });
  },

  // 加载聊天历史（从数据库加载会话）
  loadChatHistory: async () => {
    // 聊天历史已经在会话对象中，不需要单独加载
    // 如果需要从数据库重新加载，可以用 loadCanvas 方法
  },

  // 清空聊天历史
  clearChatHistory: async (chatId) => {
    const { chatSessions, nodes } = get();

    const updatedSession = chatSessions.find(s => s.id === chatId);
    if (!updatedSession) return;

    const clearedSession = {
      ...updatedSession,
      messages: [],
      startTimestamp: Date.now(),
      initialNodeSnapshot: nodes.map(n => n.id),
      updatedAt: Date.now(),
    };

    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? clearedSession : s
      ),
    });

    // 保存到数据库
    await db.updateChatSession(chatId, {
      messages: [],
      startTimestamp: clearedSession.startTimestamp,
      initialNodeSnapshot: clearedSession.initialNodeSnapshot,
      updatedAt: clearedSession.updatedAt,
    });
  },

  // 设置聊天窗口位置
  setChatWindowPosition: (chatId, position) => {
    const { chatSessions } = get();
    const updatedSessions = chatSessions.map(s =>
      s.id === chatId ? { ...s, position, updatedAt: Date.now() } : s
    );
    set({ chatSessions: updatedSessions });

    // 保存到数据库
    const session = updatedSessions.find(s => s.id === chatId);
    if (session) {
      db.updateChatSession(chatId, { position, updatedAt: session.updatedAt }).catch(err => {
        console.error('Failed to save chat position:', err);
      });
    }
  },

  // 设置聊天窗口大小
  setChatWindowSize: (chatId, size) => {
    const { chatSessions } = get();
    const updatedSessions = chatSessions.map(s =>
      s.id === chatId ? { ...s, size, updatedAt: Date.now() } : s
    );
    set({ chatSessions: updatedSessions });

    // 保存到数据库
    const session = updatedSessions.find(s => s.id === chatId);
    if (session) {
      db.updateChatSession(chatId, { size, updatedAt: session.updatedAt }).catch(err => {
        console.error('Failed to save chat size:', err);
      });
    }
  },

  // 更新聊天名称
  updateChatName: (chatId, name) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? { ...s, name, updatedAt: Date.now() } : s
      ),
    });
  },

  // 添加聊天引用
  addChatReference: (chatId, nodeId, content) => {
    const { chatSessions } = get();
    const session = chatSessions.find(s => s.id === chatId);
    if (!session) return;

    // 检查是否已经引用了这个节点
    if (session.references.some(ref => ref.nodeId === nodeId)) {
      return;
    }

    const newReference: ChatReference = {
      id: generateUUID(),
      nodeId,
      content,
      timestamp: Date.now(),
    };

    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId
          ? { ...s, references: [...s.references, newReference] }
          : s
      ),
    });
  },

  // 移除聊天引用
  removeChatReference: (chatId, referenceId) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId
          ? { ...s, references: s.references.filter(ref => ref.id !== referenceId) }
          : s
      ),
    });
  },

  // 清空所有引用
  clearChatReferences: (chatId) => {
    const { chatSessions } = get();
    set({
      chatSessions: chatSessions.map(s =>
        s.id === chatId ? { ...s, references: [] } : s
      ),
    });
  },

  // 设置拖拽文本
  setDraggingText: (text) => set({ draggingText: text }),

  // ========================================
  // 分屏模式方法
  // ========================================

  // 设置固定聊天窗口
  setDockedChat: (chatId) => {
    const { currentCanvasId, dockedWidth } = get();
    set({ dockedChatId: chatId });

    // 保存到 localStorage
    if (currentCanvasId && typeof window !== 'undefined') {
      localStorage.setItem(
        `canvas_${currentCanvasId}_docked_state`,
        JSON.stringify({ dockedChatId: chatId, dockedWidth })
      );
    }
  },

  // 设置固定窗口宽度（限制在30-50%之间）
  setDockedWidth: (width) => {
    const clampedWidth = Math.max(30, Math.min(50, width));
    const { currentCanvasId, dockedChatId } = get();
    set({ dockedWidth: clampedWidth });

    // 保存到 localStorage
    if (currentCanvasId && typeof window !== 'undefined') {
      localStorage.setItem(
        `canvas_${currentCanvasId}_docked_state`,
        JSON.stringify({ dockedChatId, dockedWidth: clampedWidth })
      );
    }
  },

  // 切换聊天窗口的固定状态
  toggleDockedChat: (chatId) => {
    const { dockedChatId, currentCanvasId, dockedWidth } = get();
    const newDockedChatId = dockedChatId === chatId ? null : chatId;

    set({ dockedChatId: newDockedChatId });

    // 保存到 localStorage
    if (currentCanvasId && typeof window !== 'undefined') {
      localStorage.setItem(
        `canvas_${currentCanvasId}_docked_state`,
        JSON.stringify({ dockedChatId: newDockedChatId, dockedWidth })
      );
    }
  },

}));
