'use client'

import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(122, 111, 103, 0.08)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{
          background: 'linear-gradient(135deg, rgba(139, 142, 99, 0.9) 0%, rgba(198, 200, 170, 0.85) 100%)',
        }}>
          {user.email?.[0].toUpperCase()}
        </div>
        <span className="text-sm hidden sm:block" style={{ color: '#3D342C' }}>{user.email}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-lg py-1 z-20 backdrop-blur-xl" style={{
            background: 'rgba(237, 228, 213, 0.98)',
            boxShadow: '0 8px 24px rgba(61, 52, 44, 0.12)',
            border: '1px solid rgba(122, 111, 103, 0.2)',
          }}>
            <div className="px-4 py-2 text-sm" style={{
              borderBottom: '1px solid rgba(122, 111, 103, 0.15)',
            }}>
              <div className="font-semibold" style={{ color: '#3D342C' }}>已登录</div>
              <div className="truncate" style={{ color: '#7A6F67' }}>{user.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-4 py-2 text-sm transition-colors"
              style={{ color: '#DC2626' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  )
}
