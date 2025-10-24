import { supabaseDB } from './supabase-db'
import { db } from './db'
import type { CanvasData, CanvasNode } from '@/types'

/**
 * 同步管理器
 * 负责 IndexedDB 和 Supabase 之间的数据同步
 */

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null
  private userId: string | null = null
  private onStatusChange?: (status: SyncStatus) => void

  constructor() {
    // 监听网络状态
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processOfflineQueue())
    }
  }

  // ========================================
  // 初始化
  // ========================================

  setUserId(userId: string) {
    this.userId = userId
  }

  setStatusChangeCallback(callback: (status: SyncStatus) => void) {
    this.onStatusChange = callback
  }

  private updateStatus(status: SyncStatus) {
    if (this.onStatusChange) {
      this.onStatusChange(status)
    }
  }

  // ========================================
  // 全量同步（登录时）
  // ========================================

  async fullSync(): Promise<void> {
    if (!this.userId) throw new Error('User ID not set')

    this.updateStatus('syncing')

    try {
      // 1. 获取本地所有画布
      const localCanvases = await db.getAllCanvases()

      // 2. 上传本地数据到云端
      for (const canvas of localCanvases) {
        await this.syncCanvasToCloud(canvas.id)
      }

      // 3. 从云端拉取所有画布（可能有其他设备的数据）
      const cloudCanvases = await supabaseDB.getAllCanvases(this.userId)

      // 4. 合并云端数据到本地
      for (const cloudCanvas of cloudCanvases) {
        const localCanvas = await db.getCanvas(cloudCanvas.id)

        if (!localCanvas) {
          // 本地没有，直接创建
          await this.saveCloudCanvasToLocal(cloudCanvas)
        } else {
          // 本地有，使用最新的
          if (cloudCanvas.updatedAt > localCanvas.updatedAt) {
            await this.saveCloudCanvasToLocal(cloudCanvas)
          }
        }
      }

      this.updateStatus('success')
      console.log('Full sync completed successfully')
    } catch (error) {
      this.updateStatus('error')
      console.error('Full sync failed:', error)
      // 显示详细错误信息
      if (error instanceof Error) {
        console.error('Full sync error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      // 不要抛出错误，让应用继续运行
      console.warn('Sync failed, but app will continue with local data')
    }
  }

  // ========================================
  // 单个画布同步
  // ========================================

  async syncCanvasToCloud(canvasId: string): Promise<void> {
    if (!this.userId) return

    try {
      const localCanvas = await db.getCanvas(canvasId)
      if (!localCanvas) return

      // 获取节点
      const localNodes = await db.getCanvasNodes(canvasId)

      // 检查云端是否存在
      const cloudCanvas = await supabaseDB.getCanvas(canvasId)

      if (!cloudCanvas) {
        // 云端不存在，创建（使用本地的 ID）
        await supabaseDB.createCanvas(this.userId, localCanvas.name, canvasId)
        console.log(`Created canvas ${canvasId} in cloud`)
      } else if (localCanvas.updatedAt > cloudCanvas.updatedAt) {
        // 本地更新，更新云端
        await supabaseDB.updateCanvas(canvasId, localCanvas.name)
        console.log(`Updated canvas ${canvasId} in cloud`)
      }

      // 同步节点（批量上传）
      if (localNodes.length > 0) {
        await supabaseDB.bulkUpsertNodes(this.userId, canvasId, localNodes)
      }

      // 同步聊天会话
      const localChatSessions = await db.getChatSessions(canvasId)
      for (const session of localChatSessions) {
        await supabaseDB.saveChatSession(this.userId, canvasId, session)
      }

      console.log(`Canvas ${canvasId} synced to cloud`)
    } catch (error) {
      console.error(`Failed to sync canvas ${canvasId}:`, error)
      // 显示详细错误信息
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      // 添加到离线队列
      this.addToOfflineQueue({ type: 'sync_canvas', canvasId })
    }
  }

  async syncCanvasFromCloud(canvasId: string): Promise<void> {
    if (!this.userId) return

    try {
      const cloudCanvas = await supabaseDB.getCanvas(canvasId)
      if (!cloudCanvas) return

      await this.saveCloudCanvasToLocal(cloudCanvas)

      // 同步聊天会话
      const cloudChatSessions = await supabaseDB.getChatSessions(canvasId)
      for (const session of cloudChatSessions) {
        await db.updateChatSession(session.id, session)
      }

      console.log(`Canvas ${canvasId} synced from cloud`)
    } catch (error) {
      console.error(`Failed to sync canvas from cloud:`, error)
    }
  }

  // ========================================
  // 定时同步
  // ========================================

  startPeriodicSync(intervalMs: number = 30000) {
    this.stopPeriodicSync()

    this.syncInterval = setInterval(async () => {
      if (!navigator.onLine) return // 离线时跳过

      try {
        const canvases = await db.getAllCanvases()
        for (const canvas of canvases) {
          await this.syncCanvasToCloud(canvas.id)
        }
      } catch (error) {
        console.error('Periodic sync failed:', error)
      }
    }, intervalMs)

    console.log(`Periodic sync started (interval: ${intervalMs}ms)`)
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('Periodic sync stopped')
    }
  }

  // ========================================
  // 离线队列
  // ========================================

  private addToOfflineQueue(operation: unknown) {
    const queue = this.getOfflineQueue()
    queue.push(operation)
    localStorage.setItem('offline_sync_queue', JSON.stringify(queue))
  }

  private getOfflineQueue(): unknown[] {
    const queueStr = localStorage.getItem('offline_sync_queue')
    return queueStr ? JSON.parse(queueStr) : []
  }

  private clearOfflineQueue() {
    localStorage.removeItem('offline_sync_queue')
  }

  async processOfflineQueue() {
    if (!navigator.onLine) return

    const queue = this.getOfflineQueue()
    if (queue.length === 0) return

    console.log(`Processing offline queue: ${queue.length} operations`)

    for (const operation of queue) {
      try {
        const op = operation as { type: string; canvasId: string }
        if (op.type === 'sync_canvas') {
          await this.syncCanvasToCloud(op.canvasId)
        }
      } catch (error) {
        console.error('Failed to process offline operation:', error)
      }
    }

    this.clearOfflineQueue()
  }

  // ========================================
  // 工具方法
  // ========================================

  private async saveCloudCanvasToLocal(cloudCanvas: CanvasData) {
    const localCanvas = await db.getCanvas(cloudCanvas.id)

    if (!localCanvas) {
      // 本地不存在，创建
      await db.canvases.add({
        id: cloudCanvas.id,
        name: cloudCanvas.name,
        nodes: cloudCanvas.nodes.map(n => ({ id: n.id })),
        createdAt: cloudCanvas.createdAt,
        updatedAt: cloudCanvas.updatedAt,
      })
    } else {
      // 本地存在，更新
      await db.updateCanvas(cloudCanvas.id, {
        name: cloudCanvas.name,
        nodes: cloudCanvas.nodes.map(n => ({ id: n.id })),
      })
    }

    // 保存所有节点
    for (const node of cloudCanvas.nodes) {
      const localNode = await db.nodes.get(node.id)
      if (!localNode) {
        await db.nodes.add(node)
      } else if (node.updatedAt > localNode.updatedAt) {
        await db.updateNode(node.id, node)
      }
    }
  }
}

// 单例
export const syncManager = new SyncManager()
