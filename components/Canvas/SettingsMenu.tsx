'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { CanvasSwitcher } from './CanvasSwitcher';
import { UserMenu } from '../Auth/UserMenu';
import { SyncStatus } from '../SyncStatus';
import type { SyncStatus as SyncStatusType } from '@/lib/sync-manager';

interface SettingsMenuProps {
  syncStatus: SyncStatusType;
}

export default function SettingsMenu({ syncStatus }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className="w-10 h-10 flex items-center justify-center bg-white/70 backdrop-blur-xl rounded-xl shadow-sm border border-gray-200/50 hover:bg-white/90 transition-all text-gray-600"
            aria-label="设置菜单"
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-0 w-72 animate-in fade-in-0 zoom-in-95 overflow-hidden"
            sideOffset={8}
            align="start"
          >
            {/* 画布 */}
            <div className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">画布</span>
              </div>
              <CanvasSwitcher />
            </div>

            {/* 分隔线 */}
            <div className="border-t border-gray-200/50" />

            {/* 操作指南 */}
            <button
              onClick={() => {
                setOpen(false);
                setHelpOpen(true);
              }}
              className="w-full px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">操作指南</span>
              </div>
              <span className="text-sm text-gray-700">查看快捷键和操作说明</span>
            </button>

            {/* 分隔线 */}
            <div className="border-t border-gray-200/50" />

            {/* 账户 */}
            <div className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">账户</span>
              </div>
              <UserMenu />
            </div>

            {/* 分隔线 */}
            <div className="border-t border-gray-200/50" />

            {/* 同步 */}
            <div className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">同步</span>
              </div>
              <SyncStatus status={syncStatus} />
            </div>

          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* 帮助对话框 */}
      <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in-0 z-[2000]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 p-6 w-[90vw] max-w-md animate-in fade-in-0 zoom-in-95 z-[2001]">
            <Dialog.Title className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              操作指南
            </Dialog.Title>

            <div className="space-y-3 text-sm text-gray-700 max-h-[60vh] overflow-y-auto">
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
    </>
  );
}
