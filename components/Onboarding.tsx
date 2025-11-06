'use client';

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface OnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  tips?: string; // 额外提示
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: '欢迎来到无边记 AI',
    description: '这是一个无限画布笔记工具，结合 AI 帮助你扩展思维边界。',
    tips: '在这里，你可以自由组织想法，让 AI 成为你的思考伙伴。'
  },
  {
    title: '创建节点',
    description: '双击画布或点击右上角的"+"按钮，可以创建文本或便签。',
    tips: '点击节点即可编辑内容，拖拽可以移动位置。'
  },
  {
    title: '画布导航',
    description: '按住 Shift 键拖动鼠标可以平移画布。',
    tips: '使用 Ctrl/Cmd + 滚轮可以缩放，滚轮可以移动画布。'
  },
  {
    title: 'AI对话',
    description: '点击左上角的聊天按钮，可以与 AI 进行对话。',
    tips: 'AI能理解整个画布的内容，还可以帮你创建节点。'
  },
  {
    title: '自由切换',
    description: '你可以同时创建多个对话窗口，还可以将其中一个固定到屏幕左侧',
    tips: '你可以同时与多个AI对话'
  },
  {
    title: '自定义样式',
    description: '选中节点后按 Shift 键，可以打开属性面板。',
    tips: '你可以自定义文字颜色、背景色、字体大小和粗细。'
  },
  {
    title: '开始探索',
    description: '你已经掌握了基本操作，现在开始自由探索吧！',
    tips: '记住：Ctrl/Cmd + Z 可以撤销，Delete 可以删除节点。'
  }
];

export default function Onboarding({ isOpen, onClose }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  // 阻止原生事件穿透到画布
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const element = contentRef.current;

    // 阻止所有可能穿透的原生事件
    const stopEvent = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation(); // 阻止所有后续监听器
    };

    // 添加原生事件监听器（捕获阶段）
    element.addEventListener('wheel', stopEvent, { capture: true, passive: false });
    element.addEventListener('mousedown', stopEvent, { capture: true });
    element.addEventListener('mouseup', stopEvent, { capture: true });
    element.addEventListener('click', stopEvent, { capture: true });
    element.addEventListener('dblclick', stopEvent, { capture: true });
    element.addEventListener('touchstart', stopEvent, { capture: true, passive: false });
    element.addEventListener('touchmove', stopEvent, { capture: true, passive: false });
    element.addEventListener('touchend', stopEvent, { capture: true });

    return () => {
      element.removeEventListener('wheel', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('mousedown', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('mouseup', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('click', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('dblclick', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('touchstart', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('touchmove', stopEvent, { capture: true } as EventListenerOptions);
      element.removeEventListener('touchend', stopEvent, { capture: true } as EventListenerOptions);
    };
  }, [isOpen]);

  const handleNext = () => {
    if (isLastStep) {
      // 标记引导完成
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding_completed', 'true');
      }
      onClose();
    } else {
      // 丝滑过渡动画
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 200); // 淡出淡入各100ms
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsTransitioning(false);
      }, 200);
    }
  };

  const step = ONBOARDING_STEPS[currentStep];

  // 安全检查：如果 step 不存在或对话框未打开，不渲染
  if (!step || !isOpen) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        {/* 遮罩层 - 不可点击关闭 */}
        <Dialog.Overlay className="fixed inset-0 z-[9998] transition-all duration-300" style={{
          background: 'rgba(61, 52, 44, 0.7)',
          backdropFilter: 'blur(8px)'
        }} />

        <Dialog.Content
          ref={contentRef}
          className="fixed top-1/2 left-1/2 z-[9999] w-[90vw] max-w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-2xl glass-effect"
          style={{
            background: '#EDE4D5',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            maxHeight: '80vh'
          }}
          onPointerDownOutside={(e) => e.preventDefault()} // 禁止点击外部关闭
          onEscapeKeyDown={(e) => e.preventDefault()} // 禁止 ESC 关闭
        >
          {/* 顶部进度条 */}
          <div className="px-6 py-4" style={{
            borderBottom: '1px solid rgba(122, 111, 103, 0.15)'
          }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-medium" style={{ color: '#3D342C' }}>
                新手引导
              </div>
              <div className="text-xs" style={{ color: '#7A6F67' }}>
                {currentStep + 1} / {ONBOARDING_STEPS.length}
              </div>
            </div>
            {/* 进度条 */}
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{
              background: 'rgba(122, 111, 103, 0.2)'
            }}>
              <div
                className="h-full transition-all duration-500 elastic-transition"
                style={{
                  width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%`,
                  background: '#B4723C'
                }}
              />
            </div>
          </div>

          {/* 内容区域 - 带淡入淡出动画 */}
          <div
            className="px-8 py-8 transition-opacity duration-200"
            style={{
              opacity: isTransitioning ? 0 : 1,
              minHeight: '420px'
            }}
          >
            {/* 演示区域占位符 */}
            <div
              className="w-full rounded-2xl overflow-hidden flex items-center justify-center mb-6 paper-texture-light"
              style={{
                height: '240px',
                background: '#F8F4EF',
                border: '1px solid #EDE4D5'
              }}
            >
              <div className="text-center" style={{ color: '#7A6F67' }}>
                <svg className="w-20 h-20 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="text-sm opacity-60">操作演示视频</div>
              </div>
            </div>

            {/* 文字说明 */}
            <div className="text-center">
              <Dialog.Title className="text-2xl font-bold mb-4" style={{ color: '#3D342C' }}>
                {step.title}
              </Dialog.Title>
              <Dialog.Description className="text-base leading-relaxed mb-3" style={{ color: '#7A6F67' }}>
                {step.description}
              </Dialog.Description>
              {step.tips && (
                <p className="text-sm leading-relaxed" style={{ color: '#7A6F67', opacity: 0.8 }}>
                  {step.tips}
                </p>
              )}
            </div>
          </div>

          {/* 底部导航 */}
          <div className="px-6 py-5 flex items-center justify-between" style={{
            borderTop: '1px solid rgba(122, 111, 103, 0.15)'
          }}>
            {/* 左侧：上一步按钮 */}
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className="px-5 py-2.5 rounded-xl transition-all elastic-transition disabled:opacity-0"
              style={{
                color: '#7A6F67',
                cursor: isFirstStep ? 'default' : 'pointer',
                pointerEvents: isFirstStep ? 'none' : 'auto'
              }}
            >
              上一步
            </button>

            {/* 中间：步骤指示器 */}
            <div className="flex items-center gap-2">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className="rounded-full transition-all duration-300 elastic-transition"
                  style={{
                    width: index === currentStep ? '32px' : '8px',
                    height: '8px',
                    background: index === currentStep ? '#B4723C' : 'rgba(122, 111, 103, 0.25)',
                    cursor: 'default'
                  }}
                />
              ))}
            </div>

            {/* 右侧：下一步/完成按钮 */}
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl transition-all duration-300 elastic-transition glass-effect hover:scale-105"
              style={{
                background: '#B4723C',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(180, 114, 60, 0.3)'
              }}
            >
              {isLastStep ? '开始使用' : '下一步'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
