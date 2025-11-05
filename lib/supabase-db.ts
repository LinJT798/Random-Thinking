import { supabase, ensureValidSession } from './supabase'
import type { CanvasData, CanvasNode, ChatSession } from '@/types'
import type { InsertCanvas, InsertNode, InsertChatSession } from '@/types/database.types'
import { generateUUID } from './uuid'

/**
 * Supabase 数据库访问层
 * 封装所有云端数据库操作
 */

export class SupabaseDB {
  /**
   * 在执行数据库操作前检查并刷新会话（如果需要）
   */
  private async checkSession(): Promise<boolean> {
    const isValid = await ensureValidSession()
    if (!isValid) {
      console.error('❌ 会话无效或已过期，请重新登录')
    }
    return isValid
  }
  // ========================================
  // 画布操作
  // ========================================

  async createCanvas(userId: string, name: string, id?: string): Promise<string> {
    await this.checkSession()

    const canvas: InsertCanvas = {
      id: id, // 允许指定 ID，用于同步
      user_id: userId,
      name,
    }

    const { data, error } = await supabase
      .from('canvases')
      .insert(canvas)
      .select('id')
      .limit(1)

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }
    if (!data || data.length === 0) throw new Error('Failed to create canvas')
    return data[0].id
  }

  async getAllCanvases(userId: string): Promise<CanvasData[]> {
    await this.checkSession()

    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }

    // 为每个画布加载节点
    const canvasesWithNodes = await Promise.all(
      data.map(async (canvas) => {
        const nodes = await this.getCanvasNodes(canvas.id)
        return {
          id: canvas.id,
          name: canvas.name,
          nodes,
          createdAt: new Date(canvas.created_at).getTime(),
          updatedAt: new Date(canvas.updated_at).getTime(),
        }
      })
    )

    return canvasesWithNodes
  }

  async getCanvas(canvasId: string): Promise<CanvasData | null> {
    await this.checkSession()

    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .limit(1)

    // 区分网络错误和真的不存在
    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }

    // 数据为空 = 画布不存在
    if (!data || data.length === 0) return null

    const canvas = data[0]

    const nodes = await this.getCanvasNodes(canvasId)

    return {
      id: canvas.id,
      name: canvas.name,
      nodes,
      createdAt: new Date(canvas.created_at).getTime(),
      updatedAt: new Date(canvas.updated_at).getTime(),
    }
  }

  async updateCanvas(canvasId: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('canvases')
      .update({ name })
      .eq('id', canvasId)

    if (error) {
      throw new Error(`Supabase error updating canvas: ${error.message || JSON.stringify(error)}`)
    }
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    // 软删除
    const { error } = await supabase
      .from('canvases')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', canvasId)

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }
  }

  // ========================================
  // 节点操作
  // ========================================

  async getCanvasNodes(canvasId: string): Promise<CanvasNode[]> {
    const { data, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }

    return data.map(this.dbNodeToCanvasNode)
  }

  async createNode(userId: string, canvasId: string, node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const insertData: InsertNode = {
      id: generateUUID(),
      canvas_id: canvasId,
      user_id: userId,
      type: node.type,
      content: node.content,
      position: node.position,
      size: node.size,
      connections: node.connections || [],
      color: node.color,
      style: (node.style || {}) as Record<string, unknown>,
      ai_metadata: node.aiMetadata as Record<string, unknown> | undefined,
      parent_id: node.parentId,
      children_ids: node.childrenIds || [],
      mindmap_metadata: node.mindMapMetadata as Record<string, unknown> | undefined,
    }

    const { data, error } = await supabase
      .from('nodes')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }
    return data.id
  }

  async updateNode(nodeId: string, updates: Partial<CanvasNode>): Promise<void> {
    const updateData: Record<string, unknown> = {}

    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.position) updateData.position = updates.position
    if (updates.size) updateData.size = updates.size
    if (updates.connections) updateData.connections = updates.connections
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.style) updateData.style = updates.style
    if (updates.aiMetadata) updateData.ai_metadata = updates.aiMetadata
    if (updates.parentId !== undefined) updateData.parent_id = updates.parentId
    if (updates.childrenIds) updateData.children_ids = updates.childrenIds
    if (updates.mindMapMetadata) updateData.mindmap_metadata = updates.mindMapMetadata

    const { error } = await supabase
      .from('nodes')
      .update(updateData)
      .eq('id', nodeId)

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', nodeId)

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }
  }

  async bulkUpsertNodes(userId: string, canvasId: string, nodes: CanvasNode[]): Promise<void> {
    // 0. 确保会话有效
    const sessionValid = await this.checkSession()
    if (!sessionValid) {
      console.warn('⚠️ 会话无效，跳过节点上传（本地数据已保存）')
      return // 不抛出错误，让应用继续工作
    }

    // 1. 尝试获取云端该画布的所有节点ID（网络错误时跳过删除步骤）
    let cloudNodeIds: string[] = []
    try {
      const { data: cloudNodes, error: fetchError } = await supabase
        .from('nodes')
        .select('id')
        .eq('canvas_id', canvasId)

      if (fetchError) {
        console.warn(`⚠️ 无法获取云端节点列表（网络问题），跳过删除步骤，仅上传节点`)
      } else {
        cloudNodeIds = cloudNodes?.map(n => n.id) || []
      }
    } catch (e) {
      console.warn(`⚠️ 获取云端节点时出错，跳过删除步骤`)
    }

    // 2. 找出需要删除的节点（云端有但本地没有的）
    if (cloudNodeIds.length > 0) {
      const localNodeIds = new Set(nodes.map(n => n.id))
      const nodesToDelete = cloudNodeIds.filter(id => !localNodeIds.has(id))

      // 3. 删除云端多余的节点
      if (nodesToDelete.length > 0) {
        console.log(`🗑️ Deleting ${nodesToDelete.length} nodes from cloud`)
        const { error: deleteError } = await supabase
          .from('nodes')
          .delete()
          .in('id', nodesToDelete)

        if (deleteError) {
          console.warn(`⚠️ 删除云端节点失败:`, deleteError.message)
          // 不抛出错误，继续尝试 upsert
        }
      }
    }

    // 4. Upsert 本地节点到云端（按依赖顺序）
    if (nodes.length > 0) {
      // 先按层级排序：父节点优先
      const sortedNodes = [...nodes].sort((a, b) => {
        // 没有 parentId 的优先（顶层节点）
        if (!a.parentId && b.parentId) return -1
        if (a.parentId && !b.parentId) return 1
        // 都有或都没有，按创建时间
        return a.createdAt - b.createdAt
      })

      const insertData: InsertNode[] = sortedNodes.map(node => ({
        id: node.id,
        canvas_id: canvasId,
        user_id: userId,
        type: node.type,
        content: node.content,
        position: node.position,
        size: node.size,
        connections: node.connections || [],
        color: node.color,
        style: (node.style || {}) as Record<string, unknown>,
        ai_metadata: node.aiMetadata as Record<string, unknown> | undefined,
        parent_id: node.parentId,
        children_ids: node.childrenIds || [],
        mindmap_metadata: node.mindMapMetadata as Record<string, unknown> | undefined,
        created_at: new Date(node.createdAt).toISOString(),
        updated_at: new Date(node.updatedAt).toISOString(),
      }))

      const { error } = await supabase
        .from('nodes')
        .upsert(insertData, { onConflict: 'id' })

      if (error) {
        // 网络错误时不抛出异常，只警告
        console.error(`❌ Supabase error upserting nodes: ${error.message || JSON.stringify(error)}`)
        console.warn(`⚠️ 节点上传失败，但本地数据已保存。下次同步时会重试。`)
        // 不抛出错误，应用继续工作
      } else {
        console.log(`✅ 成功上传 ${insertData.length} 个节点到云端`)
      }
    }
  }

  // ========================================
  // 聊天会话操作
  // ========================================

  async saveChatSession(userId: string, canvasId: string, session: ChatSession): Promise<void> {
    await this.checkSession()

    const insertData: InsertChatSession = {
      id: session.id,
      canvas_id: canvasId,
      user_id: userId,
      name: session.name,
      messages: session.messages as unknown[],
      is_open: session.isOpen,
      position: session.position,
      size: session.size,
      start_timestamp: session.startTimestamp,
      initial_node_snapshot: session.initialNodeSnapshot,
      references: session.references as unknown[],
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date(session.updatedAt).toISOString(),
    }

    const { error } = await supabase
      .from('chat_sessions')
      .upsert(insertData, { onConflict: 'id' })

    if (error) {
      // 转换为标准 Error 对象，包含详细信息
      throw new Error(`Supabase error saving chat session: ${error.message || JSON.stringify(error)}`)
    }
  }

  async getChatSessions(canvasId: string): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Supabase error: ${error.message || JSON.stringify(error)}`)
    }

    return data.map(session => ({
      id: session.id,
      canvasId: session.canvas_id,
      name: session.name,
      messages: session.messages as ChatSession['messages'],
      isOpen: session.is_open,
      position: session.position,
      size: session.size,
      startTimestamp: session.start_timestamp ?? Date.now(),
      initialNodeSnapshot: session.initial_node_snapshot,
      references: session.references as ChatSession['references'],
      createdAt: new Date(session.created_at).getTime(),
      updatedAt: new Date(session.updated_at).getTime(),
    }))
  }

  // ========================================
  // 工具方法
  // ========================================

  private dbNodeToCanvasNode(dbNode: {
    id: string
    type: string
    content: string | null
    position: { x: number; y: number }
    size: { width: number; height: number }
    connections: string[]
    color: string | null
    style: Record<string, unknown>
    ai_metadata: Record<string, unknown> | null
    parent_id: string | null
    children_ids: string[]
    mindmap_metadata: Record<string, unknown> | null
    created_at: string
    updated_at: string
  }): CanvasNode {
    return {
      id: dbNode.id,
      type: dbNode.type as CanvasNode['type'],
      content: dbNode.content || '',
      position: dbNode.position,
      size: dbNode.size,
      connections: dbNode.connections,
      color: dbNode.color || undefined,
      style: dbNode.style as CanvasNode['style'],
      aiMetadata: (dbNode.ai_metadata as unknown) as CanvasNode['aiMetadata'],
      parentId: dbNode.parent_id || undefined,
      childrenIds: dbNode.children_ids,
      mindMapMetadata: (dbNode.mindmap_metadata as unknown) as CanvasNode['mindMapMetadata'],
      createdAt: new Date(dbNode.created_at).getTime(),
      updatedAt: new Date(dbNode.updated_at).getTime(),
    }
  }
}

export const supabaseDB = new SupabaseDB()
