import { supabase } from './supabase'
import type { CanvasData, CanvasNode, ChatSession } from '@/types'
import type { InsertCanvas, InsertNode, InsertChatSession } from '@/types/database.types'

/**
 * Supabase 数据库访问层
 * 封装所有云端数据库操作
 */

export class SupabaseDB {
  // ========================================
  // 画布操作
  // ========================================

  async createCanvas(userId: string, name: string, id?: string): Promise<string> {
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

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Failed to create canvas')
    return data[0].id
  }

  async getAllCanvases(userId: string): Promise<CanvasData[]> {
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) throw error

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
    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .limit(1)

    if (error || !data || data.length === 0) return null

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

    if (error) throw error
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    // 软删除
    const { error } = await supabase
      .from('canvases')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', canvasId)

    if (error) throw error
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

    if (error) throw error

    return data.map(this.dbNodeToCanvasNode)
  }

  async createNode(userId: string, canvasId: string, node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const insertData: InsertNode = {
      id: crypto.randomUUID(),
      canvas_id: canvasId,
      user_id: userId,
      type: node.type,
      content: node.content,
      position: node.position,
      size: node.size,
      connections: node.connections || [],
      color: node.color,
      style: node.style || {},
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

    if (error) throw error
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

    if (error) throw error
  }

  async deleteNode(nodeId: string): Promise<void> {
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', nodeId)

    if (error) throw error
  }

  async bulkUpsertNodes(userId: string, canvasId: string, nodes: CanvasNode[]): Promise<void> {
    const insertData: InsertNode[] = nodes.map(node => ({
      id: node.id,
      canvas_id: canvasId,
      user_id: userId,
      type: node.type,
      content: node.content,
      position: node.position,
      size: node.size,
      connections: node.connections || [],
      color: node.color,
      style: node.style || {},
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

    if (error) throw error
  }

  // ========================================
  // 聊天会话操作
  // ========================================

  async saveChatSession(userId: string, canvasId: string, session: ChatSession): Promise<void> {
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

    if (error) throw error
  }

  async getChatSessions(canvasId: string): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })

    if (error) throw error

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
      aiMetadata: dbNode.ai_metadata as CanvasNode['aiMetadata'],
      parentId: dbNode.parent_id || undefined,
      childrenIds: dbNode.children_ids,
      mindMapMetadata: dbNode.mindmap_metadata as CanvasNode['mindMapMetadata'],
      createdAt: new Date(dbNode.created_at).getTime(),
      updatedAt: new Date(dbNode.updated_at).getTime(),
    }
  }
}

export const supabaseDB = new SupabaseDB()
