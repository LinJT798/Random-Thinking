'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

interface AuthFormProps {
  mode: 'signin' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 验证
    if (!email || !password) {
      setError('请填写所有字段')
      setLoading(false)
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('两次密码输入不一致')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符')
      setLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          setSuccess(true)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          router.push('/')
        }
      }
    } catch (err) {
      setError('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (success && mode === 'signup') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
        <h3 className="font-semibold mb-2">注册成功！</h3>
        <p className="text-sm">
          我们已向您的邮箱发送了验证邮件。请查收并点击邮件中的链接完成注册。
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          邮箱
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="your@email.com"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••"
          required
        />
      </div>

      {mode === 'signup' && (
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            确认密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••"
            required
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '处理中...' : mode === 'signup' ? '注册' : '登录'}
      </button>

      <div className="text-center text-sm text-gray-600">
        {mode === 'signup' ? (
          <p>
            已有账号？{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              立即登录
            </a>
          </p>
        ) : (
          <p>
            还没有账号？{' '}
            <a href="/signup" className="text-blue-600 hover:underline">
              立即注册
            </a>
          </p>
        )}
      </div>
    </form>
  )
}
