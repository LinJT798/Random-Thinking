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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            登录无边记 AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            无限画布笔记工具，让思维自由延展
          </p>
        </div>
        <div className="mt-8 bg-white py-8 px-6 shadow-lg rounded-lg">
          <AuthForm mode="signin" />
        </div>
      </div>
    </div>
  )
}
