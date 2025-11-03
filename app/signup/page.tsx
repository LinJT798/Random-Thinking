'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SignUpPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  // 未登录时，直接重定向到登录页面
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  // 显示加载状态
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F4EF' }}>
      <div style={{ color: '#7A6F67' }}>正在跳转...</div>
    </div>
  )
}
