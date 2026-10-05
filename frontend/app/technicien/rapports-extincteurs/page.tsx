'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  ouvert: { label: 'Ouvert', bg: '#fff2e8', color: '#9a4a13' },
  ferme: { label: 'Fermé', bg: '#e9f6f2', color: '#0d6b4f' },
}

type FiltreStatut = 'tous' | 'ouvert' | 'ferme'

export default function TechnicienRapportsExtincteursPage() {
  const router = useRouter()
  const [rapports, setRapports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<FiltreStatut>('tous')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    fetch(`${API_URL}/api/rapports-extincteurs/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        const list = Array.isArray(data) ? data : (data.results || [])
        setRapports(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const rapportsFiltres = filtre === 'tous'
    ? rapports
    : rapports.filter(r => r.statut === filtre)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Rapport Extincteur</h1>
          <p className="text-gray-400 text-sm mt-1">{rapports.length} rapport{rapports.length !== 1 ? 's' : ''} assigné{rapports.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/technicien/rapports-extincteurs/nouveau"
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 flex-shrink-0"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> Nouveau rapport
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {([
          { key: 'tous', label: 'Tous' },
          { key: 'ouvert', label: 'En cours' },
          { key: 'ferme', label: 'Terminés' },
        ] as { key: FiltreStatut; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all duration-200"
            style={{
              background: filtre === f.key ? NAVY : '#f1f5f9',
              color: filtre === f.key ? '#fff' : '#64748b',
            }}
          >
            {f.label}
            {f.key !== 'tous' && (
              <span className="ml-1.5 opacity-70">
                ({rapports.filter(r => f.key === 'tous' || r.statut === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {rapportsFiltres.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-gray-100">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f8f9fa' }}>
            <i className="ti ti-fire-extinguisher text-xl text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm font-medium">Aucun rapport {filtre !== 'tous' ? `avec le statut "${STATUT_BADGE[filtre]?.label}"` : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rapportsFiltres.map((r: any) => {
            const badge = STATUT_BADGE[r.statut] || STATUT_BADGE.ouvert

            return (
              <Link
                key={r.id}
                href={`/technicien/rapports-extincteurs/${r.id}`}
                className="bg-white rounded-md border border-gray-100 p-4 hover:shadow-md hover:border-[#dc2626] transition-all duration-200 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: NAVY }}>
                      <i className="ti ti-fire-extinguisher text-white text-sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                        {r.batiment?.adresse_complete || '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{r.batiment?.client_nom || '—'}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1">
                    <i className="ti ti-calendar text-gray-300" />
                    {r.date_inspection
                      ? new Date(r.date_inspection).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Date non définie'}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ti ti-fire-extinguisher text-gray-300" />
                    {r.nb_extincteurs || 0} extincteur{(r.nb_extincteurs || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
