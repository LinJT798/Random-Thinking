# 多画布 + 云端同步实现指南

## ✅ 已完成的工作

### Phase 1-2: 基础配置
- ✅ 安装 Supabase 依赖 (@supabase/supabase-js, @supabase/ssr, sonner)
- ✅ 创建环境变量配置 (.env.local.example)
- ✅ 创建 Supabase 客户端 (lib/supabase.ts, lib/supabase-server.ts)
- ✅ 创建数据库 SQL 脚本 (supabase-schema.sql)
- ✅ 创建数据库类型定义 (types/database.types.ts)

### Phase 3: 认证系统
- ✅ 认证 Context 和 Hooks (lib/auth-context.tsx)
- ✅ 登录页面 (app/login/page.tsx)
- ✅ 注册页面 (app/signup/page.tsx)
- ✅ 认证表单组件 (components/Auth/AuthForm.tsx)
- ✅ 用户菜单组件 (components/Auth/UserMenu.tsx)
- ✅ 认证回调路由 (app/auth/callback/route.ts)

### Phase 4-5: 数据同步层
- ✅ Supabase 数据访问层 (lib/supabase-db.ts)
- ✅ 同步管理器 (lib/sync-manager.ts)
- ✅ 画布切换器 UI (components/Canvas/CanvasSwitcher.tsx)
- ✅ 同步状态指示器 (components/SyncStatus.tsx)

---

## 🚧 待完成的工作

### Step 1: 配置 Supabase（手动操作）

#### 1.1 创建 Supabase 项目
1. 访问 https://supabase.com/dashboard
2. 点击 "New Project"
3. 填写项目信息：
   - Name: `infinite-canvas-ai`
   - Database Password: 设置一个强密码（保存好）
   - Region: 选择离你最近的区域（建议选 Singapore 或 Tokyo）

#### 1.2 执行 SQL 脚本
1. 在 Supabase Dashboard 左侧菜单选择 **SQL Editor**
2. 点击 "+ New Query"
3. 复制 `supabase-schema.sql` 的全部内容
4. 粘贴到编辑器并点击 **Run**
5. 确认所有表、索引、RLS 策略都创建成功

#### 1.3 获取 API 密钥
1. 进入 **Project Settings > API**
2. 复制以下信息：
   - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
   - `anon public` key → NEXT_PUBLIC_SUPABASE_ANON_KEY

#### 1.4 更新本地环境变量
编辑 `.env.local` 文件：
```env
ANTHROPIC_API_KEY=你的现有密钥

NEXT_PUBLIC_SUPABASE_URL=https://你的项目id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key
```

---

### Step 2: 修改主应用集成

#### 2.1 修改 app/layout.tsx
在根 layout 中添加 AuthProvider：

```tsx
import { AuthProvider } from '@/lib/auth-context'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

#### 2.2 修改 app/page.tsx
添加登录检查和画布切换器：

```tsx
'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CanvasSwitcher } from '@/components/Canvas/CanvasSwitcher'
import { UserMenu } from '@/components/Auth/UserMenu'
import { SyncStatus } from '@/components/SyncStatus'
import { syncManager } from '@/lib/sync-manager'
import type { SyncStatus as SyncStatusType } from '@/lib/sync-manager'
// ... 其他导入

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('idle')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      // 设置用户ID
      syncManager.setUserId(user.id)
      syncManager.setStatusChangeCallback(setSyncStatus)

      // 执行全量同步
      syncManager.fullSync().then(() => {
        console.log('Initial sync completed')
      })

      // 启动定时同步（30秒）
      syncManager.startPeriodicSync(30000)

      return () => {
        syncManager.stopPeriodicSync()
      }
    }
  }, [user])

  if (loading) {
    return <div>加载中...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-gray-800">无边记 AI</h1>
          <CanvasSwitcher />
        </div>
        <div className="flex items-center space-x-3">
          <SyncStatus status={syncStatus} />
          <UserMenu />
        </div>
      </div>

      {/* 原有的 Canvas 内容 */}
      <div className="flex-1">
        {/* ... 你的现有 Canvas 组件 ... */}
      </div>
    </div>
  )
}
```

---

### Step 3: 添加 Toast 通知

#### 3.1 安装 Toast 库（已完成）
```bash
npm install sonner
```

#### 3.2 在 layout.tsx 中添加 Toaster
```tsx
import { Toaster } from 'sonner'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
```

#### 3.3 在需要的地方使用 Toast
```tsx
import { toast } from 'sonner'

// 成功提示
toast.success('画布已保存')

// 错误提示
toast.error('同步失败，请检查网络')

// 加载提示
const toastId = toast.loading('正在同步...')
// 完成后
toast.success('同步成功', { id: toastId })
```

---

### Step 4: 测试流程

#### 4.1 首次使用测试
1. 启动开发服务器：`npm run dev`
2. 访问 http://localhost:3000
3. 应该会自动跳转到 /login
4. 注册一个新账号
5. 检查邮箱，点击验证链接
6. 登录成功后应该看到主界面

#### 4.2 多画布测试
1. 点击顶部的画布切换器
2. 创建几个新画布
3. 在不同画布中添加节点
4. 切换画布，确认数据保存正确
5. 删除一个画布，确认功能正常

#### 4.3 同步测试
1. 创建一些节点
2. 观察右上角同步状态
3. 等待30秒，应该自动同步
4. 打开浏览器开发工具 > Network，查看 Supabase 请求
5. 打开 Supabase Dashboard > Table Editor，确认数据已上传

#### 4.4 多设备测试
1. 在另一个浏览器或设备上登录同一账号
2. 确认能看到相同的画布
3. 在一个设备上修改，等待30秒
4. 在另一个设备上刷新，确认数据同步

#### 4.5 离线测试
1. 断开网络（关闭 Wi-Fi）
2. 创建一些节点，应该正常工作
3. 观察同步状态显示 "离线模式"
4. 重新连接网络
5. 确认数据自动上传到云端

---

## 🎯 快速启动检查清单

- [ ] Supabase 项目已创建
- [ ] SQL 脚本已执行
- [ ] .env.local 已配置
- [ ] app/layout.tsx 已添加 AuthProvider
- [ ] app/page.tsx 已集成认证和同步
- [ ] 可以注册和登录
- [ ] 可以创建和切换画布
- [ ] 数据可以同步到云端
- [ ] 多设备可以看到相同数据

---

## 📝 常见问题

### Q1: 注册后收不到验证邮件
**A:** 检查 Supabase Dashboard > Authentication > Email Templates，确认邮件服务已启用。默认情况下 Supabase 使用内置邮件服务，可能会被标记为垃圾邮件。

### Q2: 同步失败
**A:**
1. 检查 .env.local 中的 Supabase 密钥是否正确
2. 打开浏览器控制台查看错误信息
3. 检查 Supabase Dashboard > Logs 查看服务端日志

### Q3: RLS 策略导致无法访问数据
**A:** 确认 SQL 脚本中的 RLS 策略已正确执行。可以在 Supabase Dashboard > Authentication > Policies 查看。

### Q4: 类型错误
**A:** 运行 `npm run build` 检查类型错误，确保所有导入路径正确。

---

## 🚀 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 添加环境变量：
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 部署完成！

---

## 📚 下一步优化

- [ ] 添加画布重命名功能
- [ ] 添加画布搜索功能
- [ ] 实现实时多设备协作（Supabase Realtime）
- [ ] 添加数据导出功能
- [ ] 优化大画布性能
- [ ] 添加画布模板功能

---

完成以上步骤后，你的应用就具备了完整的多画布和云端同步功能！
