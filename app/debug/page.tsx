'use client'

export default function DebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">环境变量调试</h1>

        <div className="space-y-4">
          <div>
            <strong className="block mb-1">NEXT_PUBLIC_SUPABASE_URL:</strong>
            <code className="block bg-gray-100 p-2 rounded">
              {supabaseUrl || '❌ 未设置'}
            </code>
          </div>

          <div>
            <strong className="block mb-1">NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>
            <code className="block bg-gray-100 p-2 rounded">
              {hasKey ? '✅ 已设置' : '❌ 未设置'}
            </code>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm">
              如果显示 ❌ 未设置，说明 Vercel 环境变量没有生效。
              <br />
              解决方法：在 Vercel Dashboard 中重新部署项目。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
