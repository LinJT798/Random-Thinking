import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 检查 Supabase 是否已配置
export const isSupabaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url_here' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your_anon_key_here'
  )
}

// 创建 Supabase 浏览器客户端（用于客户端组件）
export function createClient() {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, cloud sync disabled')
    // 返回一个空客户端，避免运行时错误
    return null as any
  }

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

/**
 * 确保会话有效，如果 JWT 即将过期或已过期，自动刷新
 * 在执行 Supabase 操作前调用此函数
 */
export async function ensureValidSession() {
  // 如果 Supabase 未配置，直接返回 false
  if (!isSupabaseConfigured() || !supabase) {
    return false
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ 获取会话失败:', error)
      return false
    }

    if (!session) {
      console.warn('⚠️ 没有活跃的会话')
      return false
    }

    // 检查 JWT 是否即将过期（5分钟内过期）
    const expiresAt = session.expires_at
    if (!expiresAt) return true

    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = expiresAt - now

    // 如果即将过期或已过期，刷新会话
    if (timeUntilExpiry < 300) { // 5分钟
      console.log('🔄 Token即将过期，刷新会话中...')
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        console.error('❌ 刷新会话失败:', refreshError)
        return false
      }

      if (!newSession) {
        console.warn('⚠️ 会话刷新未返回新会话')
        return false
      }

      console.log('✅ 会话刷新成功')
      return true
    }

    return true
  } catch (error) {
    console.error('❌ 检查会话时出错:', error)
    return false
  }
}
