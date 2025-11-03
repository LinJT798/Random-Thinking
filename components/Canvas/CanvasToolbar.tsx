'use client';

import { useCanvasStore } from '@/lib/store';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function CanvasToolbar() {
  const { addNode } = useCanvasStore();

  // 添加文本节点
  const handleAddTextNode = async () => {
    const x = Math.random() * 500 + 100;
    const y = Math.random() * 500 + 100;

    await addNode({
      type: 'text',
      content: '',
      position: { x, y },
      size: { width: 300, height: 150 },
      connections: [],
    });
  };

  // 添加便签
  const handleAddSticky = async () => {
    const x = Math.random() * 500 + 100;
    const y = Math.random() * 500 + 100;

    await addNode({
      type: 'sticky',
      content: '',
      position: { x, y },
      size: { width: 200, height: 200 },
      connections: [],
      color: 'yellow',
    });
  };

  // 添加思维导图（暂时禁用）
  /* const handleAddMindMap = async () => {
    const x = Math.random() * 500 + 100;
    const y = Math.random() * 500 + 100;

    await addNode({
      type: 'mindmap',
      content: '中心主题',
      position: { x, y },
      size: { width: 180, height: 80 },
      connections: [],
      childrenIds: [],
      mindMapMetadata: {
        level: 0,
        collapsed: false,
        order: 0,
        layoutType: 'horizontal',
      },
    });
  }; */

  return (
    <div className="absolute top-6 right-6 z-[2000]">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="w-12 h-12 rounded-2xl transition-all elastic-transition flex items-center justify-center group glass-effect" style={{
            background: '#EDE4D5',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}>
            <svg className="w-6 h-6 transition-colors" style={{ color: '#3D342C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[120px] rounded-2xl p-2 glass-effect z-[2100] dropdown-animate-in"
            style={{
              background: '#EDE4D5',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
            sideOffset={8}
            align="end"
            onWheel={(e) => e.stopPropagation()}
          >
            <DropdownMenu.Item
              onClick={handleAddTextNode}
              className="px-3 py-2 text-white rounded-xl transition-all text-sm flex items-center gap-2 font-medium cursor-pointer outline-none mb-1.5 stagger-item"
              style={{
                background: '#8B8E63',
                boxShadow: '0 2px 8px rgba(61, 52, 44, 0.1)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>文本</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onClick={handleAddSticky}
              className="px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2 font-medium cursor-pointer outline-none stagger-item"
              style={{
                background: '#FBBF24',
                color: '#3D342C',
                boxShadow: '0 2px 8px rgba(61, 52, 44, 0.1)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>便签</span>
            </DropdownMenu.Item>

            {/* 思维导图按钮（暂时禁用） */}
            {/* <DropdownMenu.Item
              onClick={handleAddMindMap}
              className="px-4 py-2.5 text-white rounded-xl transition-all text-sm flex items-center gap-2 font-medium cursor-pointer outline-none stagger-item"
              style={{
                background: 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)',
                boxShadow: '0 2px 8px rgba(61, 52, 44, 0.1)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <span>思维导图</span>
            </DropdownMenu.Item> */}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
