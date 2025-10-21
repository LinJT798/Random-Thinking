'use client';

import * as Tooltip from '@radix-ui/react-tooltip';

export default function HelpButton() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
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
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/50 px-4 py-3 text-sm text-gray-700 space-y-2 max-w-xs"
            sideOffset={5}
          >
            <div className="font-semibold text-gray-900 mb-2">操作指南</div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono">⌘</span>
              <span>双击画布创建文本</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono">⇧</span>
              <span>Shift + 拖动平移画布</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono">⌃</span>
              <span>Ctrl + 滚轮缩放画布</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono">⌘Z</span>
              <span>撤销操作</span>
            </div>
            <Tooltip.Arrow className="fill-white/90" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
