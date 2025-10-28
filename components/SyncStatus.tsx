'use client'

import { useState, useEffect } from 'react'
import type { SyncStatus as SyncStatusType } from '@/lib/sync-manager'

export function SyncStatus({ status }: { status: SyncStatusType }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOnline) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs" style={{
        background: 'rgba(251, 191, 36, 0.15)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
      }}>
        <svg className="w-4 h-4" style={{ color: '#D97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
        <span className="font-medium" style={{ color: '#B45309' }}>离线模式</span>
      </div>
    )
  }

  switch (status) {
    case 'syncing':
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs" style={{
          background: 'rgba(139, 142, 99, 0.15)',
          border: '1px solid rgba(139, 142, 99, 0.3)',
        }}>
          <svg className="w-4 h-4 animate-spin" style={{ color: '#8B8E63' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium" style={{ color: '#8B8E63' }}>同步中...</span>
        </div>
      )
    case 'success':
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs" style={{
          background: 'rgba(139, 142, 99, 0.15)',
          border: '1px solid rgba(139, 142, 99, 0.3)',
        }}>
          <svg className="w-4 h-4" style={{ color: '#8B8E63' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium" style={{ color: '#8B8E63' }}>已同步</span>
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs" style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
        }}>
          <svg className="w-4 h-4" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium" style={{ color: '#DC2626' }}>同步失败</span>
        </div>
      )
    default:
      return null
  }
}
