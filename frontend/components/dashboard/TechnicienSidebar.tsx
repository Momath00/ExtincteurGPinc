'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const RED = '#0a0b0d'
const ACCENT = '#e11324'

const NAV_GROUPS = [
  {
    label: 'Rapports',
    items: [
      { href: '/technicien/rapports-extincteurs', label: 'Rapport Extincteur', icon: 'ti-fire-extinguisher' },
      { href: '/technicien/rapports-eclairage', label: 'Rapport Éclairage', icon: 'ti-bulb' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/technicien/clients', label: 'Clients', icon: 'ti-building' },
      { href: '/technicien/batiments', label: 'Bâtiments', icon: 'ti-home' },
    ],
  },
]

export default function TechnicienSidebar({ user, onClose }: { user: any; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

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
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/50 hover:text-white md:hidden"
          >
            <i className="ti ti-x text-lg" />
          </button>
        )}

        <Link href="/technicien" onClick={onClose} className="inline-flex flex-col items-center gap-2.5">
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
            <p className="text-white text-[11px] font-bold tracking-widest uppercase leading-tight">
              Extincteur
            </p>
            <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase">
              GP inc
            </p>
          </div>
        </Link>

        {/* Badge rôle */}
        <div className="mt-3 inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
          <i className="ti ti-tool text-[10px]" style={{ color: ACCENT }} />
          <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">Technicien</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 pb-4 flex flex-col gap-6 overflow-y-auto sidebar-scroll border-t border-white/10 pt-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/technicien' && pathname.startsWith(item.href))
                return (
                  <button
                    key={item.href}
                    onClick={() => { router.push(item.href); onClose?.() }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                    style={{
                      background: active ? ACCENT : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                      boxShadow: active ? '0 2px 8px rgba(220,38,38,0.35)' : 'none',
                    }}
                  >
                    <i
                      className={`ti ${item.icon} text-base`}
                      style={{ color: '#fff', opacity: active ? 1 : 0.7 }}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
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
            {user?.username?.[0]?.toUpperCase() || 'T'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.username || '—'}</p>
            <p className="text-white/50 text-xs">{user?.role_display || 'Technicien'}</p>
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
