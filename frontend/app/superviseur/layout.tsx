'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

export default function SuperviseurLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (data.role !== 'superviseur') {
          router.push('/login')
          return
        }
        setUser(data)
        setChecking(false)
      })
      .catch(() => router.push('/login'))
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar desktop — fixe */}
      <div className="hidden md:flex flex-col w-64 min-h-screen fixed left-0 top-0 z-40">
        <Sidebar user={user} />
      </div>

      {/* Overlay mobile */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar mobile — tiroir */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar user={user} onClose={() => setMenuOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen">

        {/* Header mobile */}
        <div className="md:hidden px-4 py-3 flex justify-between items-center sticky top-0 z-30" style={{ background: NAVY }}>
          <button onClick={() => setMenuOpen(true)} className="text-white p-1.5">
            <i className="ti ti-menu-2 text-xl" />
          </button>
          <img src="/logo.svg" alt="Extincteurs Nationex" className="h-8 w-auto" />
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: '#dc2626' }}
          >
            {user?.username?.[0]?.toUpperCase() || 'S'}
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}