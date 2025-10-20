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
    <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">添加节点</h3>

      <button
        onClick={handleAddTextNode}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm flex items-center gap-2"
      >
        <span>📄</span>
        <span>文本卡片</span>
      </button>

      <button
        onClick={handleAddSticky}
        className="px-4 py-2 bg-yellow-400 text-gray-800 rounded hover:bg-yellow-500 transition-colors text-sm flex items-center gap-2"
      >
        <span>📌</span>
        <span>便签</span>
      </button>

      <div className="border-t border-gray-200 mt-2 pt-2">
        <div className="text-xs text-gray-500">
          <div>快捷键：</div>
          <div>T = 文本</div>
          <div>S = 便签</div>
        </div>
      </div>
    </div>
  );
}
