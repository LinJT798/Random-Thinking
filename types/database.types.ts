// Supabase 数据库类型定义
// 这些类型对应 supabase-schema.sql 中的表结构

export interface Database {
  public: {
    Tables: {
      canvases: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      nodes: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          type: 'text' | 'sticky' | 'mindmap' | 'ai-generated'
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
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          type: 'text' | 'sticky' | 'mindmap' | 'ai-generated'
          content?: string | null
          position?: { x: number; y: number }
          size?: { width: number; height: number }
          connections?: string[]
          color?: string | null
          style?: Record<string, unknown>
          ai_metadata?: Record<string, unknown> | null
          parent_id?: string | null
          children_ids?: string[]
          mindmap_metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          type?: 'text' | 'sticky' | 'mindmap' | 'ai-generated'
          content?: string | null
          position?: { x: number; y: number }
          size?: { width: number; height: number }
          connections?: string[]
          color?: string | null
          style?: Record<string, unknown>
          ai_metadata?: Record<string, unknown> | null
          parent_id?: string | null
          children_ids?: string[]
          mindmap_metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          canvas_id: string
          user_id: string
          name: string
          messages: unknown[] // JSON array
          is_open: boolean
          position: { x: number; y: number }
          size: { width: number; height: number }
          start_timestamp: number | null
          initial_node_snapshot: string[]
          references: unknown[] // JSON array
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canvas_id: string
          user_id: string
          name?: string
          messages?: unknown[]
          is_open?: boolean
          position?: { x: number; y: number }
          size?: { width: number; height: number }
          start_timestamp?: number | null
          initial_node_snapshot?: string[]
          references?: unknown[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          canvas_id?: string
          user_id?: string
          name?: string
          messages?: unknown[]
          is_open?: boolean
          position?: { x: number; y: number }
          size?: { width: number; height: number }
          start_timestamp?: number | null
          initial_node_snapshot?: string[]
          references?: unknown[]
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// 辅助类型：从数据库行类型提取
export type DbCanvas = Database['public']['Tables']['canvases']['Row']
export type DbNode = Database['public']['Tables']['nodes']['Row']
export type DbChatSession = Database['public']['Tables']['chat_sessions']['Row']

// 插入类型
export type InsertCanvas = Database['public']['Tables']['canvases']['Insert']
export type InsertNode = Database['public']['Tables']['nodes']['Insert']
export type InsertChatSession = Database['public']['Tables']['chat_sessions']['Insert']

// 更新类型
export type UpdateCanvas = Database['public']['Tables']['canvases']['Update']
export type UpdateNode = Database['public']['Tables']['nodes']['Update']
export type UpdateChatSession = Database['public']['Tables']['chat_sessions']['Update']
