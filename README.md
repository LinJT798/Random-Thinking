# 无边记 AI - 思维扩展画布

一个基于 Web 的无限画布笔记工具，结合 AI 功能帮助你扩展思维、记录想法。

## 核心理念

人脑的工作记忆（RAM）是有限的，因此外部记录和 AI 辅助思考变得尤为重要。这个工具旨在：

- 💭 **扩展思维** - 通过无限画布自由组织你的想法
- 🤖 **AI 辅助** - 自动扩写、总结、整理你的笔记
- 🔒 **本地优先** - 数据存储在本地，保护隐私
- ⚡ **流畅体验** - 简洁直观的交互设计

## 功能特性

### 基础功能
- ✅ 无限画布 - 自由缩放、平移
- ✅ 文本卡片 - 创建、编辑、拖拽
- ✅ 便签 - 多种颜色的便签纸
- ✅ 本地存储 - 使用 IndexedDB 存储数据

### AI 功能
- ✅ **扩写** - 将简短想法扩展成详细内容
- ✅ **总结** - 提炼长内容的核心要点
- 🔄 整理 - 自动归类和建立连接（计划中）
- 🔄 智能建议 - AI 自动分析并提示优化（计划中）

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

复制 \`.env.local.example\` 为 \`.env.local\`，并填入你的 API Key：

\`\`\`bash
cp .env.local.example .env.local
\`\`\`

编辑 \`.env.local\`：

\`\`\`
ANTHROPIC_API_KEY=your_api_key_here
\`\`\`

**注意**：本项目使用 Claude API 代理服务（https://lumos.diandian.info/winky/claude），请联系管理员获取 API Key。

### 3. 运行开发服务器

\`\`\`bash
npm run dev
\`\`\`

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用指南

### 创建节点

1. 点击右上角的「添加节点」按钮
2. 选择「文本卡片」或「便签」
3. 双击节点开始编辑

### 使用 AI 功能

1. 选中一个包含内容的节点
2. 点击下方出现的 AI 工具栏
3. 选择「扩写」或「总结」
4. AI 会在旁边创建新节点显示结果

### 画布操作

- **平移画布**: Shift + 拖动鼠标
- **缩放**: Ctrl/Cmd + 滚轮
- **移动画布**: 滚轮

### 快捷键

- `T` - 创建文本卡片（计划中）
- `S` - 创建便签（计划中）
- `Ctrl/Cmd + Enter` - 保存编辑
- `Esc` - 取消编辑

## 技术栈

- **前端框架**: Next.js 15 + React 19 + TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **本地存储**: Dexie.js (IndexedDB)
- **AI**: Anthropic Claude API
- **UI 组件**: Radix UI + cmdk

## 项目结构

\`\`\`
infinite-canvas-ai/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   └── ai/           # AI 功能 API
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 主页
├── components/            # React 组件
│   ├── Canvas/           # 画布相关组件
│   ├── Nodes/            # 节点组件
│   └── AI/               # AI 功能组件
├── lib/                   # 工具库
│   ├── db.ts             # 数据库配置
│   ├── store.ts          # 状态管理
│   └── ai.ts             # AI 功能封装
└── types/                 # TypeScript 类型定义
    └── index.ts
\`\`\`

## 开发路线图

### MVP (已完成)
- ✅ 基础无限画布
- ✅ 文本/便签节点
- ✅ IndexedDB 本地存储
- ✅ AI 扩写和总结功能

### Phase 2 (进行中)
- 🔄 AI 自动建议系统
- 🔄 命令面板 (Cmd+K)
- 🔄 节点连线
- 🔄 多媒体支持

### Phase 3 (计划中)
- 📋 导出功能 (Markdown, PDF)
- 📋 多画布管理
- 📋 搜索功能
- 📋 撤销/重做

### Phase 4 (未来)
- 📋 云同步 (可选)
- 📋 协作功能
- 📋 移动端支持
- 📋 知识图谱生成

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 致谢

- 灵感来源于 Apple 无边记
- AI 功能由 Anthropic Claude 提供
- 感谢所有开源项目的贡献者
