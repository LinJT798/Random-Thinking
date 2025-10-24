import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 创建 Supabase 浏览器客户端（用于客户端组件）
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    }
  )
}

// 导出单例客户端实例
export const supabase = createClient()
