'use client'

import { AuthForm } from '@/components/Auth/AuthForm'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SignUpPage() {
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
            注册无边记 AI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            开始使用无限画布，扩展你的思维边界
          </p>
        </div>
        <div className="mt-8 bg-white py-8 px-6 shadow-lg rounded-lg">
          <AuthForm mode="signup" />
        </div>
      </div>
    </div>
  )
}
