-- =====================================================
-- 无边记 AI - Supabase 数据库架构
-- =====================================================
-- 使用说明：
-- 1. 访问 Supabase Dashboard: https://supabase.com/dashboard
-- 2. 选择你的项目 > SQL Editor
-- 3. 粘贴并执行此脚本
-- =====================================================

-- 1. 画布表
CREATE TABLE IF NOT EXISTS canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Canvas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- 软删除
);

-- 2. 节点表
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'sticky', 'mindmap', 'ai-generated')),
  content TEXT,
  position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
  size JSONB NOT NULL DEFAULT '{"width": 200, "height": 100}',
  connections TEXT[] DEFAULT '{}',
  color TEXT,
  style JSONB DEFAULT '{}',
  ai_metadata JSONB,
  parent_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  children_ids TEXT[] DEFAULT '{}',
  mindmap_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Chat',
  messages JSONB NOT NULL DEFAULT '[]',
  is_open BOOLEAN DEFAULT false,
  position JSONB DEFAULT '{"x": 100, "y": 100}',
  size JSONB DEFAULT '{"width": 400, "height": 600}',
  start_timestamp BIGINT,
  initial_node_snapshot TEXT[] DEFAULT '{}',
  "references" JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 索引优化
-- =====================================================

-- 画布索引
CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvases_deleted_at ON canvases(deleted_at) WHERE deleted_at IS NULL;

-- 节点索引
CREATE INDEX IF NOT EXISTS idx_nodes_canvas_id ON nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at DESC);

-- 聊天会话索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_canvas_id ON chat_sessions(canvas_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);

-- =====================================================
-- Row Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 画布策略：用户只能访问自己的画布
CREATE POLICY "Users can view their own canvases"
  ON canvases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own canvases"
  ON canvases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvases"
  ON canvases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvases"
  ON canvases FOR DELETE
  USING (auth.uid() = user_id);

-- 节点策略：用户只能访问自己的节点
CREATE POLICY "Users can view their own nodes"
  ON nodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own nodes"
  ON nodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nodes"
  ON nodes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nodes"
  ON nodes FOR DELETE
  USING (auth.uid() = user_id);

-- 聊天会话策略：用户只能访问自己的聊天
CREATE POLICY "Users can view their own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 自动更新 updated_at 触发器
-- =====================================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为画布表添加触发器
DROP TRIGGER IF EXISTS update_canvases_updated_at ON canvases;
CREATE TRIGGER update_canvases_updated_at
  BEFORE UPDATE ON canvases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为节点表添加触发器
DROP TRIGGER IF EXISTS update_nodes_updated_at ON nodes;
CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为聊天会话表添加触发器
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 完成！
-- =====================================================
-- 数据库架构创建完成
-- 现在你可以在应用中使用这些表了
-- =====================================================
