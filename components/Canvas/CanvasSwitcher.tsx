'use client'

import { useState, useEffect, useRef } from 'react'
import { db } from '@/lib/db'
import { useCanvasStore } from '@/lib/store'
import { syncManager } from '@/lib/sync-manager'
import type { CanvasData } from '@/types'

export function CanvasSwitcher() {
  const [canvases, setCanvases] = useState<CanvasData[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newCanvasName, setNewCanvasName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const { currentCanvas, loadCanvas, createNewCanvas, nodes } = useCanvasStore()
  const switchingRef = useRef(false)

  // 加载画布列表
  useEffect(() => {
    loadCanvasesList()
  }, [])

  // 当节点变化时，更新当前画布的节点计数
  useEffect(() => {
    if (currentCanvas) {
      setCanvases(prev => prev.map(c =>
        c.id === currentCanvas.id
          ? { ...c, nodes: nodes.map(n => ({ id: n.id })) }
          : c
      ))
    }
  }, [nodes.length, currentCanvas?.id])

  const loadCanvasesList = async () => {
    const allCanvases = await db.getAllCanvases()
    setCanvases(allCanvases)
  }

  const handleCreateCanvas = async () => {
    if (!newCanvasName.trim()) return

    try {
      const canvasId = await createNewCanvas(newCanvasName)
      await loadCanvas(canvasId)

      // 后台同步到云端
      syncManager.syncCanvasToCloud(canvasId).catch(err => {
        console.warn('Background sync failed:', err)
      })

      setNewCanvasName('')
      setShowCreateForm(false)
      setIsOpen(false)

      // 重新加载列表
      await loadCanvasesList()
    } catch (error) {
      console.error('Failed to create canvas:', error)
    }
  }

  const handleSwitchCanvas = async (canvasId: string) => {
    // 防止重复切换
    if (switchingRef.current || isSwitching || currentCanvas?.id === canvasId) {
      console.log('Switch already in progress or same canvas, skipping')
      return
    }

    switchingRef.current = true
    setIsSwitching(true)

    try {
      console.log(`Switching to canvas ${canvasId}`)

      // 保存当前画布状态到本地
      if (currentCanvas) {
        const store = useCanvasStore.getState()
        const currentNodes = store.nodes

        // 更新画布的节点列表
        await db.updateCanvas(currentCanvas.id, {
          nodes: currentNodes.map(n => ({ id: n.id }))
        })

        console.log(`Saved ${currentNodes.length} nodes for canvas ${currentCanvas.id}`)

        // 同步到云端（静默）
        syncManager.syncCanvasToCloud(currentCanvas.id).catch(err => {
          console.warn('Background sync failed:', err)
        })
      }

      // 加载新画布（先从本地加载，快速响应）
      await loadCanvas(canvasId)

      // 后台从云端拉取最新数据
      syncManager.syncCanvasFromCloud(canvasId).catch(err => {
        console.warn('Background cloud sync failed:', err)
      })

      setIsOpen(false)
      console.log('Canvas switched successfully')
    } catch (error) {
      console.error('Failed to switch canvas:', error)
    } finally {
      switchingRef.current = false
      setIsSwitching(false)
    }
  }

  const handleDeleteCanvas = async (canvasId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('确定要删除这个画布吗？')) return

    await db.deleteCanvas(canvasId)
    await loadCanvasesList()

    // 如果删除的是当前画布，切换到第一个画布
    if (currentCanvas?.id === canvasId && canvases.length > 1) {
      const remainingCanvases = canvases.filter(c => c.id !== canvasId)
      if (remainingCanvases.length > 0) {
        await loadCanvas(remainingCanvases[0].id)
      }
    }
  }

  return (
    <div className="relative">
      {/* 当前画布显示 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">
          {currentCanvas?.name || '选择画布'}
        </span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-gray-200 z-20 max-h-96 overflow-y-auto">
            {/* 新建画布按钮 */}
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-2 text-blue-600 border-b border-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">新建画布</span>
              </button>
            ) : (
              <div className="p-3 border-b border-gray-100">
                <input
                  type="text"
                  value={newCanvasName}
                  onChange={(e) => setNewCanvasName(e.target.value)}
                  placeholder="画布名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCanvas()
                    if (e.key === 'Escape') {
                      setShowCreateForm(false)
                      setNewCanvasName('')
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateCanvas}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    创建
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewCanvasName('')
                    }}
                    className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 画布列表 */}
            <div className="py-1">
              {canvases.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  还没有画布
                </div>
              ) : (
                canvases.map((canvas) => (
                  <div
                    key={canvas.id}
                    className={`group px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                      currentCanvas?.id === canvas.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleSwitchCanvas(canvas.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={`text-sm truncate ${currentCanvas?.id === canvas.id ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                          {canvas.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 ml-6">
                        {canvas.nodes.length} 个节点
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                      title="删除画布"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
