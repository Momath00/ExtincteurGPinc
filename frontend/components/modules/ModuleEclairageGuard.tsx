'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useModules } from '@/lib/modules'

/** Redirige vers les rapports extincteurs si le module éclairage n'est pas activé. */
export default function ModuleEclairageGuard({ children }: { children: React.ReactNode }) {
  const modules = useModules()
  const router = useRouter()
  const pathname = usePathname()
  const actif = modules?.module_eclairage

  useEffect(() => {
    if (modules && !actif) {
      router.replace(pathname?.startsWith('/technicien') ? '/technicien/rapports-extincteurs' : '/superviseur/rapports-extincteurs')
    }
  }, [modules, actif, router, pathname])

  if (!actif) return null
  return <>{children}</>
}
