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

  const { addNode, updateNode, setAIProcessing, chatSessions, addChatReference } = useCanvasStore();

  const hasOpenChats = chatSessions.some(s => s.isOpen);

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
        // 直接更新当前节点的内容，保持原类型（透明背景）
        updateNode(node.id, {
          content: response.content,
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
        // 在原节点上方创建新节点（普通文本节点，透明背景，无AI标志）
        await addNode({
          type: 'text',
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

  // 添加到聊天框
  const handleAddTo = () => {
    if (!node.content.trim()) {
      setError('节点内容为空');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Add to all open chats
    const openChats = chatSessions.filter(s => s.isOpen);
    openChats.forEach(chat => {
      addChatReference(chat.id, node.id, node.content);
    });
  };

  return (
    <div
      className="bg-gray-800/60 backdrop-blur-sm rounded-lg shadow-lg p-1.5 flex flex-col gap-1.5 animate-in fade-in-0 zoom-in-95 duration-200"
      style={{ transformOrigin: 'top left' }}
    >
      {hasOpenChats && (
        <button
          onClick={handleAddTo}
          disabled={isProcessing}
          className="bg-green-500/20 hover:bg-green-500/30 text-white px-2.5 py-1 rounded text-[10px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium transition-all border border-green-400/30"
          title="添加到聊天引用"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add to</span>
        </button>
      )}

      {error && (
        <div className="bg-red-500/20 text-red-200 px-2.5 py-1 rounded text-[10px] font-medium border border-red-400/30">
          {error}
        </div>
      )}
    </div>
  );
}
