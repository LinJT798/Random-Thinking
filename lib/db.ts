import Dexie, { Table } from 'dexie';
import type { CanvasData, CanvasNode } from '@/types';

// 扩展 Dexie 数据库类
export class CanvasDatabase extends Dexie {
  // 声明表
  canvases!: Table<CanvasData>;
  nodes!: Table<CanvasNode>;

  constructor() {
    super('InfiniteCanvasDB');

    // 定义数据库架构
    this.version(1).stores({
      canvases: 'id, name, createdAt, updatedAt',
      nodes: 'id, type, createdAt, updatedAt, [aiMetadata.source]'
    });
  }

  // 创建新画布
  async createCanvas(name: string = 'Untitled Canvas'): Promise<string> {
    const canvas: CanvasData = {
      id: crypto.randomUUID(),
      name,
      nodes: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.canvases.add(canvas);
    return canvas.id;
  }

  // 获取画布
  async getCanvas(id: string): Promise<CanvasData | undefined> {
    return await this.canvases.get(id);
  }

  // 获取所有画布
  async getAllCanvases(): Promise<CanvasData[]> {
    return await this.canvases.orderBy('updatedAt').reverse().toArray();
  }

  // 更新画布
  async updateCanvas(id: string, updates: Partial<CanvasData>): Promise<void> {
    await this.canvases.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  // 添加节点
  async addNode(canvasId: string, node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const newNode: CanvasNode = {
      ...node,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.nodes.add(newNode);

    // 更新画布的更新时间
    await this.updateCanvas(canvasId, {});

    return newNode.id;
  }

  // 获取画布的所有节点
  async getCanvasNodes(canvasId: string): Promise<CanvasNode[]> {
    const canvas = await this.getCanvas(canvasId);
    if (!canvas) return [];

    const nodeIds = canvas.nodes.map(n => n.id);
    return await this.nodes.where('id').anyOf(nodeIds).toArray();
  }

  // 更新节点
  async updateNode(nodeId: string, updates: Partial<CanvasNode>): Promise<void> {
    await this.nodes.update(nodeId, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  // 删除节点
  async deleteNode(canvasId: string, nodeId: string): Promise<void> {
    await this.nodes.delete(nodeId);

    // 从画布中移除节点引用
    const canvas = await this.getCanvas(canvasId);
    if (canvas) {
      canvas.nodes = canvas.nodes.filter(n => n.id !== nodeId);
      await this.updateCanvas(canvasId, { nodes: canvas.nodes });
    }
  }

  // 删除画布
  async deleteCanvas(id: string): Promise<void> {
    const canvas = await this.getCanvas(id);
    if (canvas) {
      // 删除所有关联的节点
      const nodeIds = canvas.nodes.map(n => n.id);
      await this.nodes.bulkDelete(nodeIds);
    }
    await this.canvases.delete(id);
  }
}

// 创建数据库实例
export const db = new CanvasDatabase();

// 初始化数据库
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
