'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

function StatutBadge({ statut, certificatEnvoye }: { statut: string; certificatEnvoye?: boolean }) {
  if (statut === 'ferme') {
    if (certificatEnvoye) {
      return (
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 bg-green-50 text-green-700">
          <i className="ti ti-certificate text-[10px]" /> Certificat disponible
        </span>
      )
    }
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-500">
        En attente du certificat
      </span>
    )
  }
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#fff2e8', color: '#9a4a13' }}>
      Inspection en cours
    </span>
  )
}

export default function CitoyenRapportsExtincteursPage() {
  const router = useRouter()
  const [rapports, setRapports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Rapport Extincteur</h1>
        <p className="text-gray-400 text-sm mt-1">Consultez l'état de la vérification de vos extincteurs portatifs</p>
      </div>

      {rapports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-md border border-gray-100">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f8f9fa' }}>
            <i className="ti ti-fire-extinguisher text-xl text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm font-medium">Aucun rapport à afficher pour le moment.</p>
          <p className="text-gray-300 text-xs mt-1">Vous serez notifié lorsqu'une inspection vous est associée.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rapports.map((r: any) => (
            <Link
              key={r.id}
              href={`/citoyen/rapports-extincteurs/${r.id}`}
              className="bg-white rounded-md border border-gray-100 p-4 hover:shadow-md hover:border-[#dc2626] transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: NAVY }}>
                    <i className="ti ti-fire-extinguisher text-white text-base" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                      {r.batiment?.adresse_complete || '—'}
                    </p>
                    {r.date_inspection && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        <i className="ti ti-calendar mr-1" />
                        {new Date(r.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <StatutBadge statut={r.statut} certificatEnvoye={r.certificat?.certificat_envoye} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
