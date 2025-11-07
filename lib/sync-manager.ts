import { supabaseDB } from './supabase-db'
import { db } from './db'
import { ensureValidSession, isSupabaseConfigured } from './supabase'
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
  private debouncedSyncTimers: Map<string, NodeJS.Timeout> = new Map() // 防抖定时器

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

    // 检查 Supabase 是否配置
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping cloud sync')
      return
    }

    this.updateStatus('syncing')

    try {
      // 确保会话有效
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        this.updateStatus('error')
        console.error('❌ 会话无效或已过期，无法同步。请重新登录。')
        return
      }
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

    // 检查 Supabase 是否配置
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping cloud sync')
      return
    }

    try {
      // 确保会话有效（静默检查，不影响用户体验）
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('⚠️ 会话无效，跳过云端同步（本地数据已保存）')
        this.addToOfflineQueue({ type: 'sync_canvas', canvasId })
        return
      }
      const localCanvas = await db.getCanvas(canvasId)
      if (!localCanvas) return

      // 获取节点
      const localNodes = await db.getCanvasNodes(canvasId)

      // 检查云端是否存在
      let cloudCanvas = null
      let hasFetchError = false

      try {
        cloudCanvas = await supabaseDB.getCanvas(canvasId)
      } catch (fetchError) {
        hasFetchError = true
        console.warn(`⚠️ 无法检查云端画布状态（可能网络问题），跳过画布元数据同步`)
        // 网络错误时，跳过画布创建/更新，继续同步节点
      }

      if (!hasFetchError) {
        if (cloudCanvas === null) {
          // 云端真的不存在（不是网络错误），创建
          try {
            await supabaseDB.createCanvas(this.userId, localCanvas.name, canvasId)
            console.log(`Created canvas ${canvasId} in cloud`)
          } catch (createError: unknown) {
            // 如果是主键冲突，说明画布其实存在，忽略错误
            if (createError instanceof Error && createError.message?.includes('duplicate key')) {
              console.warn(`⚠️ 画布 ${canvasId} 已存在，跳过创建`)
            } else {
              throw createError
            }
          }
        } else if (localCanvas.updatedAt > cloudCanvas.updatedAt) {
          // 本地更新，更新云端
          await supabaseDB.updateCanvas(canvasId, localCanvas.name)
          console.log(`Updated canvas ${canvasId} in cloud`)
        }
      }

      // 同步节点（批量上传）
      console.log(`Syncing ${localNodes.length} nodes for canvas ${canvasId}`)
      if (localNodes.length > 0) {
        await supabaseDB.bulkUpsertNodes(this.userId, canvasId, localNodes)
        console.log(`✅ Successfully synced ${localNodes.length} nodes to cloud`)
      } else {
        console.log('No nodes to sync for this canvas')
      }

      // 同步聊天会话
      const localChatSessions = await db.getChatSessions(canvasId)
      console.log(`Syncing ${localChatSessions.length} chat sessions for canvas ${canvasId}`)
      for (const session of localChatSessions) {
        try {
          console.log(`Syncing chat session ${session.id} with ${session.messages.length} messages`)
          await supabaseDB.saveChatSession(this.userId, canvasId, session)
          console.log(`✅ Chat session ${session.id} synced successfully`)
        } catch (sessionError) {
          console.error(`❌ Failed to sync chat session ${session.id}:`, sessionError)
          console.error('Session details:', {
            id: session.id,
            messageCount: session.messages.length,
            name: session.name,
          })
          // 继续同步其他会话，不中断整个流程
        }
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

      // 检查 Supabase 是否配置
      if (!isSupabaseConfigured()) {
        return
      }

      // 检查 session 是否有效
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('⚠️ Session invalid during periodic sync, skipping (data saved locally)')
        return
      }

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
  // 防抖同步 - 修改后5秒无新修改才同步
  // ========================================

  debouncedSyncCanvas(canvasId: string, delayMs: number = 5000) {
    // 清除该画布之前的定时器
    const existingTimer = this.debouncedSyncTimers.get(canvasId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 设置新的定时器
    const timer = setTimeout(async () => {
      console.log(`🔄 防抖同步触发 - Canvas: ${canvasId}`)
      await this.syncCanvasToCloud(canvasId)
      this.debouncedSyncTimers.delete(canvasId)
    }, delayMs)

    this.debouncedSyncTimers.set(canvasId, timer)
    console.log(`⏱️ 防抖同步已设置 - ${delayMs}ms 后执行`)
  }

  // 取消所有防抖同步
  cancelAllDebouncedSyncs() {
    this.debouncedSyncTimers.forEach((timer) => clearTimeout(timer))
    this.debouncedSyncTimers.clear()
    console.log('All debounced syncs cancelled')
  }

  // 立即同步（不防抖）- 用于重要操作
  async immediateSyncCanvas(canvasId: string) {
    // 取消该画布的防抖同步（如果有）
    const existingTimer = this.debouncedSyncTimers.get(canvasId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.debouncedSyncTimers.delete(canvasId)
    }

    console.log(`⚡ 立即同步 - Canvas: ${canvasId}`)
    await this.syncCanvasToCloud(canvasId)
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
        nodes: cloudCanvas.nodes,
        createdAt: cloudCanvas.createdAt,
        updatedAt: cloudCanvas.updatedAt,
      })
    } else {
      // 本地存在，更新
      await db.updateCanvas(cloudCanvas.id, {
        name: cloudCanvas.name,
        nodes: cloudCanvas.nodes,
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
