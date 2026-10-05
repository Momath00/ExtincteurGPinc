'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const RED = '#0a0b0d'
const ACCENT = '#e11324'

const NAV_GROUPS = [
  {
    label: 'Général',
    items: [{ href: '/superviseur', label: 'Tableau de bord', icon: 'ti-layout-dashboard' }],
  },
  {
    label: 'Gestion',
    items: [
      {
        href: '/superviseur/rapports-extincteurs',
        label: 'Rapports extincteurs',
        icon: 'ti-fire-extinguisher',
      },
      {
        href: '/superviseur/rapports-eclairage',
        label: 'Rapports éclairage',
        icon: 'ti-bulb',
      },
      {
        href: '/superviseur/certificats',
        label: 'Certificats',
        icon: 'ti-certificate',
      },
      { href: '/superviseur/clients', label: 'Clients', icon: 'ti-building' },
      { href: '/superviseur/batiments', label: 'Bâtiments', icon: 'ti-home' },
    ],
  },
  {
    label: 'Équipe',
    items: [{ href: '/superviseur/equipe', label: 'Équipe', icon: 'ti-users' }],
  },
]

export default function Sidebar({ user, onClose }: { user: any; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_username')
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: RED }}>

      {/* ── En-tête ── */}
      <div className="relative px-5 pt-7 pb-6 text-center flex-shrink-0">
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-white/50 hover:text-white md:hidden">
            <i className="ti ti-x text-lg" />
          </button>
        )}

        <Link href="/superviseur" onClick={onClose} className="inline-flex flex-col items-center gap-2.5">
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src="/logo.svg"
              alt="ExtincteurGPinc"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const p = e.currentTarget.parentElement
                if (p) p.innerHTML = `<span style="font-size:18px;font-weight:800;color:${RED};">GP</span>`
              }}
            />
          </div>
          <div>
            <p className="text-white text-[11px] font-bold tracking-widest uppercase leading-tight">Extincteur</p>
            <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">GP inc</p>
          </div>
        </Link>

        <div className="mt-3 inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
          <i className="ti ti-shield-check text-[10px]" style={{ color: ACCENT }} />
          <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">Superviseur</span>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-4 flex flex-col gap-6 overflow-y-auto sidebar-scroll border-t border-white/10 pt-6">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item: any, i) => {
                const hasChildren = !!item.children
                const itemPath = item.href.split('?')[0]
                const active = pathname === item.href || (pathname === itemPath && !item.href.includes('?'))
                const groupIsOpen = openGroup === item.href
                const childActive = hasChildren && item.children.some((c: any) => c.href === pathname)

                return (
                  <div key={item.href}>
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          setOpenGroup(groupIsOpen ? null : item.href)
                        } else {
                          router.push(item.href)
                          onClose?.()
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                      style={{
                        background: active || childActive ? ACCENT : 'transparent',
                        color: active || childActive ? '#fff' : 'rgba(255,255,255,0.65)',
                        boxShadow: active || childActive ? '0 2px 8px rgba(220,38,38,0.35)' : 'none',
                      }}
                    >
                      <i
                        className={`ti ${item.icon} text-base`}
                        style={{ color: '#fff', opacity: active || childActive ? 1 : 0.7 }}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {hasChildren && (
                        <i className={`ti ti-chevron-right text-xs transition-transform duration-200 ${groupIsOpen ? 'rotate-90' : ''}`} />
                      )}
                    </button>

                    {hasChildren && (
                      <div
                        className="overflow-hidden transition-all duration-200 ease-out pl-4"
                        style={{ maxHeight: groupIsOpen ? `${item.children.length * 40}px` : '0px' }}
                      >
                        {item.children.map((child: any) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className="flex items-center gap-2 pl-6 pr-3 py-2 text-xs rounded-md transition-colors duration-150"
                            style={{ color: pathname === child.href ? '#fff' : 'rgba(255,255,255,0.5)' }}
                          >
                            <span className="w-1 h-1 rounded-full" style={{ background: pathname === child.href ? ACCENT : 'rgba(255,255,255,0.3)' }} />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Pied — utilisateur + déconnexion ── */}
      <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 mb-3 group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: ACCENT }}
          >
            {user?.username?.[0]?.toUpperCase() || 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.username || '—'}</p>
            <p className="text-white/50 text-xs">{user?.role_display || 'Superviseur'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-md text-xs text-white/60 hover:bg-white/5 hover:text-white hover:translate-x-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <i className="ti ti-logout text-sm" /> Se déconnecter
        </button>
      </div>
    </div>
  )
}
