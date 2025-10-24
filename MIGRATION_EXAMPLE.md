# 数据迁移示例：添加画布标签功能

## 场景
为画布添加标签功能，允许用户为画布打标签（如：工作、学习、个人）

---

## Step 1: 更新 TypeScript 类型

### 修改 `types/index.ts`
```typescript
export interface CanvasData {
  id: string;
  name: string;
  nodes: CanvasNode[];
  tags?: string[]; // 新增：标签数组
  createdAt: number;
  updatedAt: number;
}
```

### 修改 `types/database.types.ts`
```typescript
export interface Database {
  public: {
    Tables: {
      canvases: {
        Row: {
          id: string
          user_id: string
          name: string
          tags: string[] | null  // 新增
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          tags?: string[] | null  // 新增
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          // ... 同样添加 tags
        }
      }
    }
  }
}
```

---

## Step 2: 升级 IndexedDB Schema

### 修改 `lib/db.ts`

在构造函数中添加新版本：

```typescript
constructor() {
  super('InfiniteCanvasDB');

  // ... 保留版本 1-4 的代码 ...

  // ✨ 升级到版本 5：添加标签功能
  this.version(5).stores({
    canvases: 'id, name, createdAt, updatedAt, *tags', // *tags 表示多值索引
    nodes: 'id, type, createdAt, updatedAt, [aiMetadata.source]',
    chatSessions: 'id, canvasId, createdAt, updatedAt'
  }).upgrade(async tx => {
    console.log('Upgrading to version 5: Adding tags support');

    // 为所有现有画布添加空标签数组
    const canvases = await tx.table('canvases').toArray();

    for (const canvas of canvases) {
      if (!canvas.tags) {
        await tx.table('canvases').update(canvas.id, {
          tags: [] // 默认空数组
        });
      }
    }

    console.log(`✅ Migrated ${canvases.length} canvases to version 5`);
  });
}
```

---

## Step 3: 升级 Supabase Schema

### 创建迁移文件（推荐方式）

如果使用 Supabase CLI：

```bash
supabase migration new add_tags_to_canvases
```

编辑生成的文件：

```sql
-- supabase/migrations/20251024123456_add_tags_to_canvases.sql

-- 添加 tags 列
ALTER TABLE canvases
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 为旧数据设置默认值
UPDATE canvases
SET tags = '{}'
WHERE tags IS NULL;

-- 添加索引（支持按标签查询）
CREATE INDEX IF NOT EXISTS idx_canvases_tags
ON canvases USING GIN(tags);

-- 添加注释
COMMENT ON COLUMN canvases.tags IS 'Canvas tags for categorization';
```

应用迁移：
```bash
supabase db push
```

---

### 手动迁移（Dashboard 方式）

在 **Supabase Dashboard → SQL Editor** 执行：

```sql
-- 1. 添加列
ALTER TABLE canvases
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. 更新现有数据
UPDATE canvases
SET tags = '{}'
WHERE tags IS NULL;

-- 3. 添加索引（可选，提升查询性能）
CREATE INDEX IF NOT EXISTS idx_canvases_tags
ON canvases USING GIN(tags);
```

---

## Step 4: 更新数据访问层

### 修改 `lib/supabase-db.ts`

```typescript
async createCanvas(userId: string, name: string, id?: string, tags?: string[]): Promise<string> {
  const canvas: InsertCanvas = {
    id: id,
    user_id: userId,
    name,
    tags: tags || [], // 新增
  }
  // ...
}

async updateCanvasTags(canvasId: string, tags: string[]): Promise<void> {
  const { error } = await supabase
    .from('canvases')
    .update({ tags })
    .eq('id', canvasId)

  if (error) throw error
}
```

---

## Step 5: 更新同步逻辑

### 修改 `lib/sync-manager.ts`

确保同步时包含新字段：

```typescript
async syncCanvasToCloud(canvasId: string): Promise<void> {
  // ...

  if (!cloudCanvas) {
    await supabaseDB.createCanvas(
      this.userId,
      localCanvas.name,
      canvasId,
      localCanvas.tags // 新增
    )
  } else {
    // 如果云端没有 tags 字段，补充上去
    if (localCanvas.tags && !cloudCanvas.tags) {
      await supabaseDB.updateCanvasTags(canvasId, localCanvas.tags)
    }
  }
}
```

---

## Step 6: 部署和测试

### 测试场景

**场景 1：新用户**
- 注册 → 直接使用新结构
- ✅ 应该没问题

**场景 2：老用户（有旧数据）**
- 打开应用 → IndexedDB 自动升级到版本5
- ✅ Console 显示 "Upgrading to version 5"
- ✅ 旧画布自动添加 `tags: []`

**场景 3：多设备同步**
- 设备A（新版本）有 tags 字段
- 设备B（旧版本）没有 tags 字段
- ✅ 同步时不应该出错（因为字段是可选的）

---

## 🎯 迁移最佳实践

### ✅ DO（推荐）

1. **向后兼容**
   ```typescript
   // ✅ 使用可选字段
   thumbnail?: string
   tags?: string[]
   ```

2. **渐进式迁移**
   ```typescript
   // ✅ 先添加字段，后续版本再设置为必需
   version(5): 添加 thumbnail?
   version(6): 为所有画布生成 thumbnail
   version(7): thumbnail 改为必需（如果确实需要）
   ```

3. **提供默认值**
   ```typescript
   // ✅ IndexedDB 升级时
   thumbnail: canvas.thumbnail || null

   // ✅ Supabase 中
   ALTER TABLE ADD COLUMN tags TEXT[] DEFAULT '{}'
   ```

4. **记录迁移日志**
   ```typescript
   .upgrade(async tx => {
     console.log('Upgrading to version 5...')
     // 迁移逻辑
     console.log('✅ Migration completed')
   })
   ```

5. **测试回退**
   ```typescript
   // ✅ 确保新代码能处理没有新字段的数据
   const tags = canvas.tags || []
   ```

---

### ❌ DON'T（避免）

1. **删除字段**
   ```typescript
   // ❌ 不要删除已有字段
   this.version(5).stores({
     canvases: 'id, name' // ❌ 删除了 createdAt, updatedAt
   })
   ```

2. **修改主键**
   ```typescript
   // ❌ 不要修改 id 字段类型
   ALTER TABLE canvases ALTER COLUMN id TYPE INTEGER
   ```

3. **破坏性修改**
   ```sql
   -- ❌ 不要直接删除列
   ALTER TABLE canvases DROP COLUMN name
   ```

4. **假设新字段存在**
   ```typescript
   // ❌ 不要假设新字段一定存在
   const tags = canvas.tags.map(...) // 如果 tags 是 undefined 会报错

   // ✅ 应该这样
   const tags = (canvas.tags || []).map(...)
   ```

---

## 🚨 复杂场景处理

### 场景 1: 修改字段类型

**需求**：将 `createdAt` 从 `number` 改为 `string`

**策略**：分两步

**第1步：添加新字段**
```typescript
// Version 5
export interface CanvasData {
  createdAt: number;
  createdAtNew?: string; // 新字段
}

// 迁移
.upgrade(async tx => {
  const canvases = await tx.table('canvases').toArray();
  for (const canvas of canvases) {
    await tx.table('canvases').update(canvas.id, {
      createdAtNew: new Date(canvas.createdAt).toISOString()
    });
  }
})
```

**第2步：逐步切换**
```typescript
// Version 6（几周后）
export interface CanvasData {
  createdAt: string; // 改为必需
  // 删除 createdAtNew
}

// 迁移
.upgrade(async tx => {
  const canvases = await tx.table('canvases').toArray();
  for (const canvas of canvases) {
    if (typeof canvas.createdAt === 'number') {
      await tx.table('canvases').update(canvas.id, {
        createdAt: new Date(canvas.createdAt).toISOString()
      });
    }
  }
})
```

---

### 场景 2: 重命名字段

**需求**：`name` → `title`

**策略**：双写期过渡

```typescript
// Version 5: 同时保留两个字段
export interface CanvasData {
  name: string;
  title?: string; // 新字段
}

.upgrade(async tx => {
  const canvases = await tx.table('canvases').toArray();
  for (const canvas of canvases) {
    await tx.table('canvases').update(canvas.id, {
      title: canvas.name // 复制数据
    });
  }
})

// Version 6（几周后）：删除旧字段
export interface CanvasData {
  title: string; // 只保留新字段
}
```

---

### 场景 3: 删除字段（谨慎！）

**需求**：删除不再使用的 `color` 字段

**策略**：软删除 → 硬删除

**阶段1**：标记为废弃（1-2个版本周期）
```typescript
export interface CanvasData {
  /** @deprecated Use style.backgroundColor instead */
  color?: string;
}
```

**阶段2**：从类型中移除
```typescript
// Version 6
export interface CanvasData {
  // color 已删除
}

// IndexedDB 不需要特别处理（多余字段会被忽略）

// Supabase 可选：删除列（慎重！）
ALTER TABLE canvases DROP COLUMN IF EXISTS color;
```

---

## 📊 版本兼容性矩阵

| 应用版本 | IndexedDB | Supabase | 用户影响 |
|---------|-----------|----------|---------|
| v1.0 | version 4 | 原始 schema | 正常使用 |
| v1.1 | version 5 | + tags 列 | 自动升级，无感知 |
| v1.2 | version 6 | + thumbnail 列 | 继续自动升级 |

**关键**：用户从任何版本升级都应该无缝！

---

## 🎯 你的具体场景

### 如果你要添加新功能

**例子**：添加画布分享功能

**需要的字段**：
- `is_public` (boolean)
- `share_token` (string)
- `share_expiry` (timestamp)

**完整迁移步骤**：

1. **更新类型**
2. **IndexedDB 版本 4 → 5**
3. **Supabase 添加3个新列**
4. **更新同步逻辑包含新字段**
5. **测试旧数据兼容性**
6. **部署**

---

## ⚠️ 部署时的注意事项

### 部署顺序

**正确顺序**：
1. ✅ **先**升级 Supabase Schema（添加列）
2. ✅ **后**部署新代码

**为什么？**
- 新代码可能会写入新字段
- 如果 Supabase 没有该列 → 报错
- 但 Supabase 有多余的列 → 不影响旧代码

**错误顺序（❌）**：
1. ❌ 先部署新代码
2. ❌ 后升级 Supabase
3. 💥 中间会有错误

---

### 灰度发布策略（可选）

如果担心迁移出问题：

**方案1：功能开关**
```typescript
// 环境变量控制
const ENABLE_TAGS_FEATURE = process.env.NEXT_PUBLIC_ENABLE_TAGS === 'true'

if (ENABLE_TAGS_FEATURE) {
  // 使用新功能
}
```

**方案2：数据库快照**
```bash
# 在 Supabase Dashboard > Database > Backups
# 手动创建快照
```

---

## 📝 迁移检查清单

每次数据结构变更前：

- [ ] 新字段是可选的（`?`）还是必需的？
- [ ] 旧数据如何处理？（默认值是什么）
- [ ] IndexedDB 版本号递增了吗？
- [ ] Supabase 迁移 SQL 写好了吗？
- [ ] 数据访问层更新了吗？
- [ ] 同步逻辑包含新字段了吗？
- [ ] 在本地测试过旧数据升级吗？
- [ ] 部署顺序对吗？（先 DB 后代码）

---

## 🔧 快速参考

### IndexedDB 版本升级模板

```typescript
this.version(X).stores({
  // 表结构（只写索引字段）
  canvases: 'id, name, newField',
}).upgrade(async tx => {
  // 数据迁移逻辑
  const items = await tx.table('canvases').toArray();
  for (const item of items) {
    if (!item.newField) {
      await tx.table('canvases').update(item.id, {
        newField: defaultValue
      });
    }
  }
  console.log(`Migrated ${items.length} records`);
});
```

### Supabase 迁移 SQL 模板

```sql
-- 添加新列（兼容旧数据）
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT default_value;

-- 更新旧数据
UPDATE table_name
SET new_column = default_value
WHERE new_column IS NULL;

-- 添加索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_name
ON table_name(new_column);

-- 添加注释（可选）
COMMENT ON COLUMN table_name.new_column IS 'Description';
```

---

## 🎉 总结

**关键原则**：
1. ✅ **向后兼容**：新字段用可选类型
2. ✅ **渐进式**：分多个版本逐步迁移
3. ✅ **有默认值**：旧数据自动填充
4. ✅ **先 DB 后代码**：部署顺序很重要
5. ✅ **充分测试**：特别是旧数据升级路径

遵循这些原则，你的数据迁移就会非常平滑，用户完全无感知！
