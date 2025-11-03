'use client'

import { AuthForm } from '@/components/Auth/AuthForm'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F4EF' }}>
        <div style={{ color: '#7A6F67' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: '#F8F4EF' }}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold" style={{ color: '#3D342C' }}>
            登录无边记 AI
          </h2>
          <p className="mt-2 text-center text-sm" style={{ color: '#7A6F67' }}>
            无限画布笔记工具，让思维自由延展
          </p>
        </div>
        <div className="mt-8 py-8 px-6 glass-effect rounded-2xl" style={{
          background: '#EDE4D5',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <AuthForm mode="signin" />
        </div>
      </div>
    </div>
  )
}
