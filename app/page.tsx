'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Canvas from '@/components/Canvas/Canvas';
import CanvasToolbar from '@/components/Canvas/CanvasToolbar';
import DraggingTextBubble from '@/components/DraggingTextBubble';
import { CanvasSwitcher } from '@/components/Canvas/CanvasSwitcher';
import { UserMenu } from '@/components/Auth/UserMenu';
import { SyncStatus } from '@/components/SyncStatus';
import { initDatabase } from '@/lib/db';
import { useCanvasStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { syncManager } from '@/lib/sync-manager';
import type { SyncStatus as SyncStatusType } from '@/lib/sync-manager';
import { toast } from 'sonner';

export default function Home() {
  const [isReady, setIsReady] = useState(false);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('idle');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 初始化数据库和同步
  useEffect(() => {
    // 防止重复初始化
    if (!user || initializingRef.current || initializedRef.current) return;

    initializingRef.current = true;

    async function initialize(userId: string) {
      try {
        console.log('Starting initialization...');

        // 初始化本地数据库
        await initDatabase();

        // 设置同步管理器
        syncManager.setUserId(userId);
        syncManager.setStatusChangeCallback(setSyncStatus);

        // 执行全量同步
        console.log('Starting full sync...');
        toast.loading('正在同步数据...', { id: 'initial-sync' });
        await syncManager.fullSync();
        toast.success('数据同步完成', { id: 'initial-sync' });

        // 启动定时同步（30秒）
        syncManager.startPeriodicSync(30000);

        console.log('✅ Sync enabled successfully');

        // 加载或创建第一个画布
        const { db } = await import('@/lib/db');
        const allCanvases = await db.getAllCanvases();

        console.log(`Found ${allCanvases.length} existing canvases`);

        if (allCanvases.length > 0) {
          // 加载最近使用的画布
          const store = useCanvasStore.getState();
          await store.loadCanvas(allCanvases[0].id);
          setCanvasId(allCanvases[0].id);
        } else {
          // 创建第一个画布
          console.log('Creating first canvas...');
          const store = useCanvasStore.getState();
          const id = await store.createNewCanvas('我的思维画布');
          setCanvasId(id);
          await syncManager.syncCanvasToCloud(id);
          console.log('Canvas created and synced:', id);
        }

        setIsReady(true);
        initializedRef.current = true;
        console.log('Initialization completed');
      } catch (error) {
        console.error('Failed to initialize:', error);
        toast.error('初始化失败，请刷新页面重试');
        initializingRef.current = false;
      }
    }

    initialize(user.id);

    return () => {
      syncManager.stopPeriodicSync();
    };
  }, [user]); // 只依赖 user

  // 认证加载中
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  // 未登录则不渲染（会被重定向）
  if (!user) {
    return null;
  }

  // 数据初始化中
  if (!isReady || !canvasId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">正在初始化...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-gray-800">无边记 AI</h1>
          <CanvasSwitcher />
        </div>
        <div className="flex items-center space-x-3">
          <SyncStatus status={syncStatus} />
          <UserMenu />
        </div>
      </div>

      {/* 主画布区域 */}
      <main className="relative flex-1 overflow-hidden">
        <Canvas canvasId={canvasId} />
        <CanvasToolbar />
        <DraggingTextBubble />
      </main>
    </div>
  );
}
