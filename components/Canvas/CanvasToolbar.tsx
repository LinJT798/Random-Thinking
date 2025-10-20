'use client';

import { useCanvasStore } from '@/lib/store';

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

  return (
    <div className="absolute top-6 right-6 flex flex-col gap-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200/50 p-2">
      <button
        onClick={handleAddTextNode}
        className="px-4 py-2.5 bg-blue-500/90 text-white rounded-xl hover:bg-blue-600 transition-all text-sm flex items-center gap-2 font-medium shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>文本</span>
      </button>

      <button
        onClick={handleAddSticky}
        className="px-4 py-2.5 bg-yellow-400/90 text-gray-800 rounded-xl hover:bg-yellow-500 transition-all text-sm flex items-center gap-2 font-medium shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span>便签</span>
      </button>
    </div>
  );
}
