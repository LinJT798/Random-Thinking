'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ScreenTextDebugger from './ScreenTextDebugger';
import TerminalChat from './TerminalChat';

interface ScreenTextConfig {
  left: number;      // 百分比 0-100
  top: number;       // 百分比 0-100
  width: number;     // 百分比 0-100
  height: number;    // 百分比 0-100
  rotateX: number;   // X轴旋转（上下倾斜）-90 到 90
  rotateY: number;   // Y轴旋转（左右倾斜）-90 到 90
  rotateZ: number;   // Z轴旋转（平面旋转）-45 到 45
  perspective: number; // 透视距离 px
  fontSize: number;  // px
  color: string;     // 颜色
}

export default function LandingPage() {
  const router = useRouter();
  const [showDebugger, setShowDebugger] = useState(false); // 默认关闭调试器
  const [config, setConfig] = useState<ScreenTextConfig>({
    left: 63.5,
    top: 38.5,
    width: 27,
    height: 27,
    rotateX: -1,
    rotateY: 18.5,
    rotateZ: -2.5,
    perspective: 2000,
    fontSize: 16,
    color: '#00FF41', // 经典终端绿
  });

  // 从 localStorage 加载保存的配置
  useEffect(() => {
    const saved = localStorage.getItem('landing_screen_config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }, []);

  // 保存配置到 localStorage
  const handleConfigChange = (newConfig: ScreenTextConfig) => {
    setConfig(newConfig);
    localStorage.setItem('landing_screen_config', JSON.stringify(newConfig));
  };

  // 快捷键切换调试器（Ctrl/Cmd + Shift + D，隐藏入口）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setShowDebugger(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStart = () => {
    // 标记已访问过首页
    localStorage.setItem('landing_visited', 'true');
    router.push('/app');
  };

  return (
    <div
      className="h-screen w-screen overflow-y-scroll snap-y snap-mandatory paper-texture"
      style={{
        background: 'linear-gradient(180deg, #F9F6F1 0%, #F3EFE9 100%)',
        scrollBehavior: 'smooth',
      }}
    >
      {/* 第一屏：麦金塔电脑 */}
      <section className="h-screen w-screen flex items-center justify-center snap-start snap-always relative">
        {/* 麦金塔电脑图片容器 - 文字层相对于图片定位 */}
        <div className="relative landing-fade-in">
          {/* 图片 */}
          <img
            src="/macintosh.png"
            alt="Macintosh Computer"
            className="max-w-2xl w-full h-auto relative"
            style={{
              filter: 'drop-shadow(0 20px 40px rgba(61, 52, 44, 0.2))',
            }}
          />

          {/* 屏幕终端层 - 相对于图片定位（使用百分比，与图片尺寸绑定） */}
          <div
            className="absolute"
            style={{
              left: `${config.left}%`,
              top: `${config.top}%`,
              width: `${config.width}%`,
              height: `${config.height}%`,
              perspective: `${config.perspective}px`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="relative"
              style={{
                width: '100%',
                height: '100%',
                transform: `translate(-50%, -50%) rotateX(${config.rotateX}deg) rotateY(${config.rotateY}deg) rotateZ(${config.rotateZ}deg)`,
                transformStyle: 'preserve-3d',
                // 调试模式下使用 outline（不占空间）和 box-shadow（不影响布局）
                ...(showDebugger && {
                  outline: '2px dashed rgba(255, 0, 0, 0.6)',
                  outlineOffset: '0px',
                  boxShadow: 'inset 0 0 0 200px rgba(255, 255, 0, 0.08)',
                }),
              }}
            >
            {/* 中心点标记（调试模式） */}
            {showDebugger && (
              <>
                <div
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: '12px',
                    height: '12px',
                    background: 'red',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    border: '2px solid white',
                    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                    zIndex: 100,
                  }}
                />
                {/* 水平参考线 */}
                <div
                  className="absolute"
                  style={{
                    left: '0',
                    right: '0',
                    top: '50%',
                    height: '1px',
                    background: 'rgba(255, 0, 0, 0.3)',
                    zIndex: 100,
                  }}
                />
                {/* 垂直参考线 */}
                <div
                  className="absolute"
                  style={{
                    top: '0',
                    bottom: '0',
                    left: '50%',
                    width: '1px',
                    background: 'rgba(255, 0, 0, 0.3)',
                    zIndex: 100,
                  }}
                />
              </>
            )}

              {/* 终端对话组件 */}
              <TerminalChat
                config={{
                  fontSize: config.fontSize,
                  color: config.color,
                  rotateX: config.rotateX,
                  rotateY: config.rotateY,
                  rotateZ: config.rotateZ,
                }}
                showDebugger={showDebugger}
              />
            </div>
          </div>
        </div>

        {/* 向下滚动提示 */}
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 landing-fade-in cursor-pointer"
          style={{
            animationDelay: '1500ms',
            color: '#7A6F67',
          }}
          onClick={() => {
            document.getElementById('content-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="text-sm">向下滑动探索</div>
          <svg
            className="w-6 h-6 animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* 第二屏：产品介绍 */}
      <section
        id="content-section"
        className="h-screen w-screen flex flex-col items-center justify-center snap-start snap-always"
      >
        {/* 产品标题 */}
        <h1
          className="text-6xl font-bold mb-4"
          style={{
            color: '#3D342C',
          }}
        >
          无边记 AI
        </h1>

        {/* Slogan */}
        <p
          className="text-2xl mb-8"
          style={{
            color: '#7A6F67',
          }}
        >
          扩展思维，记录灵感
        </p>

        {/* 核心理念 */}
        <p
          className="text-base mb-12 max-w-md text-center leading-relaxed"
          style={{
            color: '#7A6F67',
          }}
        >
          人脑的工作记忆是有限的<br />
          让 AI 帮你扩展思维边界
        </p>

        {/* 功能特点 */}
        <div className="flex gap-8 mb-12">
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="text-3xl">💭</div>
            <div className="text-sm font-medium" style={{ color: '#3D342C' }}>无限画布</div>
          </div>
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="text-3xl">🤖</div>
            <div className="text-sm font-medium" style={{ color: '#3D342C' }}>AI 辅助</div>
          </div>
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="text-3xl">🔒</div>
            <div className="text-sm font-medium" style={{ color: '#3D342C' }}>本地优先</div>
          </div>
        </div>

        {/* 开始使用按钮 */}
        <button
          onClick={handleStart}
          className="px-12 py-4 text-lg font-semibold rounded-2xl glass-effect transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #8B8E63 0%, #C6C8AA 100%)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 24px rgba(139, 142, 99, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(139, 142, 99, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 142, 99, 0.3)';
          }}
        >
          开始使用
        </button>
      </section>

      {/* 可视化调试面板 */}
      {showDebugger && (
        <ScreenTextDebugger
          config={config}
          onChange={handleConfigChange}
          onClose={() => setShowDebugger(false)}
        />
      )}
    </div>
  );
}
