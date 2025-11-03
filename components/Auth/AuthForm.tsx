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
      <div className="rounded-2xl p-4" style={{
        background: 'rgba(139, 142, 99, 0.15)',
        border: '1px solid rgba(139, 142, 99, 0.3)',
        color: '#3D342C'
      }}>
        <h3 className="font-semibold mb-2">注册成功！</h3>
        <p className="text-sm" style={{ color: '#7A6F67' }}>
          我们已向您的邮箱发送了验证邮件。请查收并点击邮件中的链接完成注册。
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: '#3D342C' }}>
          邮箱
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-2xl paper-texture-light transition-all elastic-transition focus:outline-none"
          style={{
            background: '#F8F4EF',
            border: '1px solid #EDE4D5',
            color: '#3D342C'
          }}
          placeholder="your@email.com"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: '#3D342C' }}>
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-2xl paper-texture-light transition-all elastic-transition focus:outline-none"
          style={{
            background: '#F8F4EF',
            border: '1px solid #EDE4D5',
            color: '#3D342C'
          }}
          placeholder="••••••"
          required
        />
      </div>

      {mode === 'signup' && (
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1" style={{ color: '#3D342C' }}>
            确认密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl paper-texture-light transition-all elastic-transition focus:outline-none"
            style={{
              background: '#F8F4EF',
              border: '1px solid #EDE4D5',
              color: '#3D342C'
            }}
            placeholder="••••••"
            required
          />
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-3 text-sm" style={{
          background: 'rgba(180, 114, 60, 0.15)',
          border: '1px solid rgba(180, 114, 60, 0.3)',
          color: '#3D342C'
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 rounded-2xl glass-effect transition-all elastic-transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: '#EDE4D5',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#3D342C'
        }}
      >
        {loading ? '处理中...' : mode === 'signup' ? '注册' : '登录'}
      </button>

      {mode === 'signup' && (
        <div className="text-center text-sm" style={{ color: '#7A6F67' }}>
          <p>
            已有账号？{' '}
            <a href="/login" className="hover:underline" style={{ color: '#B4723C' }}>
              立即登录
            </a>
          </p>
        </div>
      )}
    </form>
  )
}
