'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Modules = { module_eclairage: boolean }

// Une seule requête par chargement de page, partagée entre les composants.
let cache: Promise<Modules> | null = null

function chargerModules(): Promise<Modules> {
  if (!cache) {
    cache = fetch(`${API_URL}/api/config/`)
      .then(res => res.json())
      .catch(() => ({ module_eclairage: false }))
  }
  return cache
}

/** Modules activés côté serveur (MODULE_ECLAIRAGE…) — `null` pendant le chargement. */
export function useModules(): Modules | null {
  const [modules, setModules] = useState<Modules | null>(null)
  useEffect(() => {
    chargerModules().then(setModules)
  }, [])
  return modules
}
