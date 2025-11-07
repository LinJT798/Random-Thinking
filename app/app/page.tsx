'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Canvas from '@/components/Canvas/Canvas';
import CanvasToolbar from '@/components/Canvas/CanvasToolbar';
import DraggingTextBubble from '@/components/DraggingTextBubble';
import ChatResizer from '@/components/Chat/ChatResizer';
import Onboarding from '@/components/Onboarding';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
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

        // 检查本地是否有数据
        const { db } = await import('@/lib/db');
        const localCanvases = await db.getAllCanvases();
        const hasLocalData = localCanvases.length > 0;

        console.log(`Found ${localCanvases.length} local canvases`);

        // 如果本地没有数据，需要先同步云端数据
        if (!hasLocalData) {
          console.log('No local data, syncing from cloud first...');
          toast.loading('正在从云端加载数据...', { id: 'initial-sync' });

          try {
            await syncManager.fullSync();
            toast.success('数据加载完成', { id: 'initial-sync' });
          } catch (error) {
            console.error('Initial sync failed:', error);
            toast.dismiss('initial-sync');
            // 即使同步失败，也允许用户使用（会创建新画布）
          }
        }

        // 重新获取画布列表（可能已经从云端同步）
        const allCanvases = await db.getAllCanvases();
        console.log(`Total canvases: ${allCanvases.length}`);

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
          console.log('Canvas created:', id);
          // 后台同步新画布（不阻塞）
          syncManager.syncCanvasToCloud(id).catch((err) => {
            console.error('Failed to sync new canvas:', err);
          });
        }

        setIsReady(true);
        initializedRef.current = true;
        console.log('✅ Initialization completed');

        // 如果本地有数据，后台异步同步云端更新
        if (hasLocalData) {
          console.log('Starting background sync...');
          syncManager.fullSync()
            .then(() => {
              console.log('✅ Background sync completed');
              // 静默同步，不显示toast（避免打扰用户）
            })
            .catch((error) => {
              console.error('Background sync failed:', error);
              // 后台同步失败不显示错误（不打扰用户）
            });
        }

        // 启动定时同步（30秒）
        syncManager.startPeriodicSync(30000);

        // 检查是否是第一次登录，显示新手引导
        const hasSeenOnboarding = localStorage.getItem('onboarding_completed');
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
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
      <Canvas
        canvasId={canvasId}
        syncStatus={syncStatus}
        onOpenOnboarding={() => setShowOnboarding(true)}
      />
      <CanvasToolbar />
      <DraggingTextBubble />
      <ChatResizer />

      {/* 新手引导 */}
      <Onboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
