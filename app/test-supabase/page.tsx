'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabasePage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult('Testing...')

    try {
      // 测试1: 简单查询
      const { data, error, status, statusText } = await supabase
        .from('canvases')
        .select('*')
        .limit(1)

      if (error) {
        setResult(`❌ Error:\nStatus: ${status} ${statusText}\nMessage: ${error.message}\nDetails: ${JSON.stringify(error, null, 2)}`)
      } else {
        setResult(`✅ Success!\nStatus: ${status}\nData: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      setResult(`❌ Exception: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const testAuth = async () => {
    setLoading(true)
    setResult('Testing auth...')

    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setResult(`❌ Auth Error: ${error.message}`)
      } else if (!data.session) {
        setResult('⚠️ No active session - please login first')
      } else {
        setResult(`✅ Logged in as: ${data.session.user.email}`)
      }
    } catch (err) {
      setResult(`❌ Exception: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Supabase Connection Test</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">环境变量</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ Not set'}
            </div>
            <div>
              <strong>Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?
                `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}... (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)` :
                '❌ Not set'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={testAuth}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Test Auth
            </button>
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Test Database Query
            </button>
          </div>

          <div className="bg-gray-100 rounded p-4 min-h-[200px]">
            <pre className="whitespace-pre-wrap text-sm">{result || '点击按钮开始测试...'}</pre>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-semibold mb-2">📝 说明</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>先点击 "Test Auth" 确认登录状态</li>
            <li>再点击 "Test Database Query" 测试数据库连接</li>
            <li>如果看到 406 错误，复制完整的错误信息</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
