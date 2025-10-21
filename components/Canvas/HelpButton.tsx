'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="w-10 h-10 flex items-center justify-center bg-white/70 backdrop-blur-xl rounded-xl shadow-sm border border-gray-200/50 hover:bg-white/90 transition-all text-gray-600"
          aria-label="帮助"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-6 w-[90vw] max-w-md animate-in fade-in-0 zoom-in-95">
          <Dialog.Title className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            操作指南
          </Dialog.Title>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">基本操作</h3>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">双击画布</kbd>
                <span>创建文本节点</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">拖动节点</kbd>
                <span>移动节点位置</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">双击节点</kbd>
                <span>编辑节点内容</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">视图控制</h3>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Shift + 拖动</kbd>
                <span>平移画布</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Ctrl + 滚轮</kbd>
                <span>缩放画布</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">滚轮</kbd>
                <span>上下移动画布</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">编辑操作</h3>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Ctrl/Cmd + Z</kbd>
                <span>撤销</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Ctrl/Cmd + Shift + Z</kbd>
                <span>重做</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Backspace / Delete</kbd>
                <span>删除选中节点</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">节点功能</h3>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Tab</kbd>
                <span>显示 AI 工具栏</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Z</kbd>
                <span>显示属性面板</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Ctrl/Cmd + Enter</kbd>
                <span>保存编辑</span>
              </div>
              <div className="flex items-start gap-3 pl-2">
                <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono whitespace-nowrap">Esc</kbd>
                <span>取消编辑</span>
              </div>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              aria-label="关闭"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
