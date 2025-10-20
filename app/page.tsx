'use client';

import { useEffect, useState } from 'react';
import Canvas from '@/components/Canvas/Canvas';
import CanvasToolbar from '@/components/Canvas/CanvasToolbar';
import { initDatabase } from '@/lib/db';
import { useCanvasStore } from '@/lib/store';

export default function Home() {
  const [isReady, setIsReady] = useState(false);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const { createNewCanvas } = useCanvasStore();

  useEffect(() => {
    async function initialize() {
      try {
        // 初始化数据库
        await initDatabase();

        // 创建或加载画布
        const id = await createNewCanvas('我的思维画布');
        setCanvasId(id);
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    }

    initialize();
  }, [createNewCanvas]);

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
    <main className="relative w-full h-screen overflow-hidden">
      <Canvas canvasId={canvasId} />
      <CanvasToolbar />

      {/* 标题 */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-6 py-3">
        <h1 className="text-xl font-bold text-gray-800">无边记 AI - 思维扩展画布</h1>
      </div>
    </main>
  );
}
