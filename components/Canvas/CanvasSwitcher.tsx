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
          ? { ...c, nodes }
          : c
      ))
    }
  }, [nodes.length, currentCanvas?.id, nodes])

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

      // 保存当前画布状态到本地并同步到云端
      if (currentCanvas) {
        const store = useCanvasStore.getState()
        const currentNodes = store.nodes

        console.log(`Saving ${currentNodes.length} nodes for canvas ${currentCanvas.id}`)

        // 同步到云端（静默，后台执行）
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
      {/* 当前画布显示 - 纸感风格 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
        style={{
          background: 'rgba(248, 244, 239, 0.8)',
          border: '1px solid rgba(122, 111, 103, 0.2)',
          boxShadow: '0 2px 4px rgba(61, 52, 44, 0.05)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248, 244, 239, 1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(248, 244, 239, 0.8)'}
      >
        <svg className="w-5 h-5" style={{ color: '#7A6F67' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium" style={{ color: '#3D342C' }}>
          {currentCanvas?.name || '选择画布'}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#7A6F67' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[2050]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-2 w-72 rounded-xl z-[2100] max-h-96 overflow-y-auto glass-effect" style={{
            background: '#EDE4D5',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}>
            {/* 新建画布按钮 - 焦糖橙 */}
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-4 py-3 text-left flex items-center space-x-2 font-medium transition-colors rounded-t-xl"
                style={{
                  color: '#B4723C',
                  borderBottom: '1px solid rgba(122, 111, 103, 0.15)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(180, 114, 60, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>新建画布</span>
              </button>
            ) : (
              <div className="p-3" style={{ borderBottom: '1px solid rgba(122, 111, 103, 0.15)' }}>
                <input
                  type="text"
                  value={newCanvasName}
                  onChange={(e) => setNewCanvasName(e.target.value)}
                  placeholder="画布名称"
                  className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
                  style={{
                    background: 'rgba(248, 244, 239, 0.8)',
                    border: '1px solid rgba(122, 111, 103, 0.2)',
                    color: '#3D342C',
                  }}
                  autoFocus
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(139, 142, 99, 0.5)';
                    e.currentTarget.style.outline = '1px solid rgba(139, 142, 99, 0.3)';
                    e.currentTarget.style.outlineOffset = '0';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(122, 111, 103, 0.2)';
                    e.currentTarget.style.outline = 'none';
                  }}
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
                    className="flex-1 px-3 py-1.5 text-white rounded-lg text-sm transition-all"
                    style={{
                      background: 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 1) 0%, rgba(196, 129, 76, 0.95) 100%)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(180, 114, 60, 0.9) 0%, rgba(180, 114, 60, 0.8) 100%)'}
                  >
                    创建
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewCanvasName('')
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{
                      background: 'rgba(122, 111, 103, 0.1)',
                      color: '#7A6F67',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(122, 111, 103, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)'}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 画布列表 */}
            <div className="py-1">
              {canvases.length === 0 ? (
                <div className="px-4 py-3 text-sm text-center" style={{ color: '#7A6F67' }}>
                  还没有画布
                </div>
              ) : (
                canvases.map((canvas) => (
                  <div
                    key={canvas.id}
                    className="group px-4 py-3 cursor-pointer flex items-center justify-between transition-colors"
                    style={{
                      background: currentCanvas?.id === canvas.id ? 'rgba(139, 142, 99, 0.15)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (currentCanvas?.id !== canvas.id) {
                        e.currentTarget.style.background = 'rgba(122, 111, 103, 0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentCanvas?.id !== canvas.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    onClick={() => handleSwitchCanvas(canvas.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#7A6F67' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={`text-sm truncate ${currentCanvas?.id === canvas.id ? 'font-medium' : ''}`} style={{
                          color: currentCanvas?.id === canvas.id ? '#8B8E63' : '#3D342C',
                        }}>
                          {canvas.name}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 ml-6" style={{ color: '#7A6F67' }}>
                        {canvas.nodes.length} 个节点
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                      style={{ color: '#DC2626' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="删除画布"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
