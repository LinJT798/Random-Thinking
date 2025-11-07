'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import LandingPage from '@/components/LandingPage/LandingPage';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showLanding, setShowLanding] = useState<boolean | null>(null);

  // 检查是否需要显示 Landing Page
  useEffect(() => {
    if (authLoading) return;

    // 未登录，重定向到登录页
    if (!user) {
      router.push('/login');
      return;
    }

    // 已登录，检查是否访问过 landing page
    const hasVisited = localStorage.getItem('landing_visited');

    if (hasVisited === 'true') {
      // 已访问过，直接进入画布
      router.push('/app');
    } else {
      // 首次访问，显示 landing page
      setShowLanding(true);
    }
  }, [user, authLoading, router]);

  // 加载中状态
  if (authLoading || showLanding === null) {
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

  // 显示 Landing Page
  if (showLanding) {
    return <LandingPage />;
  }

  // 其他情况返回 null（会被重定向）
  return null;
}
