'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Canvas from '@/components/Canvas/Canvas';
import CanvasToolbar from '@/components/Canvas/CanvasToolbar';
import DraggingTextBubble from '@/components/DraggingTextBubble';
import ChatResizer from '@/components/Chat/ChatResizer';
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

        // 检查本地数据是否属于当前用户
        const lastUserId = localStorage.getItem('last_user_id');
        if (lastUserId && lastUserId !== userId) {
          console.warn('⚠️ Detected user switch, clearing local data...');
          await indexedDB.deleteDatabase('InfiniteCanvasDB');
          localStorage.removeItem('offline_sync_queue');
          await initDatabase();
          console.log('✅ Local data cleared for new user');
        }
        localStorage.setItem('last_user_id', userId);

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

        // 加载或创建画布
        const { db } = await import('@/lib/db');
        const allCanvases = await db.getAllCanvases();

        console.log(`Found ${allCanvases.length} existing canvases`);

        if (allCanvases.length > 0) {
          // 尝试加载上次使用的画布
          const lastCanvasId = localStorage.getItem('last_canvas_id');
          let canvasToLoad = allCanvases[0].id; // 默认第一个

          // 检查上次的画布是否存在
          if (lastCanvasId && allCanvases.some(c => c.id === lastCanvasId)) {
            canvasToLoad = lastCanvasId;
            console.log(`恢复上次使用的画布: ${lastCanvasId}`);
          } else {
            console.log('使用最近更新的画布');
          }

          const store = useCanvasStore.getState();
          await store.loadCanvas(canvasToLoad);
          setCanvasId(canvasToLoad);
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

  // 认证加载中 - 纸感风格
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen paper-texture" style={{
        background: 'linear-gradient(180deg, #F9F6F1 0%, #F3EFE9 100%)',
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 mx-auto mb-4" style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'rgba(139, 142, 99, 0.2)',
            borderBottomColor: 'rgba(139, 142, 99, 0.9)',
          }}></div>
          <div style={{ color: '#7A6F67' }}>加载中...</div>
        </div>
      </div>
    );
  }

  // 未登录则不渲染（会被重定向）
  if (!user) {
    return null;
  }

  // 数据初始化中 - 纸感风格
  if (!isReady || !canvasId) {
    return (
      <div className="flex items-center justify-center h-screen paper-texture" style={{
        background: 'linear-gradient(180deg, #F9F6F1 0%, #F3EFE9 100%)',
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 mx-auto mb-4" style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'rgba(139, 142, 99, 0.2)',
            borderBottomColor: 'rgba(139, 142, 99, 0.9)',
          }}></div>
          <div style={{ color: '#7A6F67' }}>正在初始化...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      {/* 全屏画布 */}
      <Canvas canvasId={canvasId} syncStatus={syncStatus} />
      <CanvasToolbar />
      <DraggingTextBubble />
      <ChatResizer />
    </div>
  );
}
