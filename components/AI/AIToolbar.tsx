'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/lib/store';
import { expandContent, summarizeContent } from '@/lib/ai';
import type { CanvasNode } from '@/types';

interface AIToolbarProps {
  node: CanvasNode;
}

export default function AIToolbar({ node }: AIToolbarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addNode, setAIProcessing } = useCanvasStore();

  // 扩写内容
  const handleExpand = async () => {
    if (!node.content.trim()) {
      setError('请先输入一些内容');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsProcessing(true);
    setAIProcessing(true);
    setError(null);

    try {
      const response = await expandContent(node.id, node.content);

      if (response.success && response.content) {
        // 在原节点旁边创建新节点
        await addNode({
          type: 'ai-generated',
          content: response.content,
          position: {
            x: node.position.x + node.size.width + 50,
            y: node.position.y,
          },
          size: {
            width: node.size.width,
            height: node.size.height,
          },
          connections: [node.id],
          aiMetadata: {
            source: 'ai-expanded',
            prompt: node.content,
            timestamp: Date.now(),
            originalNodeId: node.id,
          },
        });
      } else {
        setError(response.error || '扩写失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Expand error:', err);
      setError('扩写时出错');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessing(false);
      setAIProcessing(false);
    }
  };

  // 总结内容
  const handleSummarize = async () => {
    if (!node.content.trim()) {
      setError('请先输入一些内容');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsProcessing(true);
    setAIProcessing(true);
    setError(null);

    try {
      const response = await summarizeContent(node.id, node.content);

      if (response.success && response.content) {
        // 在原节点上方创建新节点
        await addNode({
          type: 'ai-generated',
          content: response.content,
          position: {
            x: node.position.x,
            y: node.position.y - 250,
          },
          size: {
            width: node.size.width,
            height: 200,
          },
          connections: [node.id],
          aiMetadata: {
            source: 'ai-summarized',
            prompt: node.content,
            timestamp: Date.now(),
            originalNodeId: node.id,
          },
        });
      } else {
        setError(response.error || '总结失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Summarize error:', err);
      setError('总结时出错');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessing(false);
      setAIProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExpand}
        disabled={isProcessing}
        className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        title="AI 扩写这段内容"
      >
        {isProcessing ? '处理中...' : '✨ 扩写'}
      </button>

      <button
        onClick={handleSummarize}
        disabled={isProcessing}
        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        title="AI 总结这段内容"
      >
        {isProcessing ? '处理中...' : '📝 总结'}
      </button>

      {error && (
        <div className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
