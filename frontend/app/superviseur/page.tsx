'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import InviteModal from '@/components/dashboard/InviteModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const RED = '#0f172a'
const ACCENT = '#dc2626'

const STATUT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  ouvert: { label: 'Ouvert', bg: '#fef2f2', color: '#9a4a13' },
  ferme: { label: 'Fermé', bg: '#e9f6f2', color: '#0d6b4f' },
}

export default function SuperviseurDashboard() {
  const router = useRouter()
  const [rapports, setRapports] = useState<any[]>([])
  const [nbClients, setNbClients] = useState(0)
  const [nbTechniciens, setNbTechniciens] = useState(0)
  const [nbCitoyens, setNbCitoyens] = useState(0)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  function chargerDonnees() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`${API_URL}/api/rapports-extincteurs/`, { headers }),
      fetch(`${API_URL}/api/clients/`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers }),
      fetch(`${API_URL}/api/utilisateurs/?role=citoyen`, { headers }),
    ])
      .then(async ([rapportsRes, clientsRes, techRes, citRes]) => {
        if (rapportsRes.status === 401) { router.push('/login'); return }
        const [rapportsData, clientsData, techData, citData] = await Promise.all([
          rapportsRes.json(), clientsRes.json(), techRes.json(), citRes.json(),
        ])

        const rapportsList = Array.isArray(rapportsData) ? rapportsData : (rapportsData.results || [])
        const clientsList = Array.isArray(clientsData) ? clientsData : (clientsData.results || [])
        const techList = Array.isArray(techData) ? techData : (techData.results || [])
        const citList = Array.isArray(citData) ? citData : (citData.results || [])

        setRapports(rapportsList)
        setNbClients(clientsList.length)
        setNbTechniciens(techList.length)
        setNbCitoyens(citList.length)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    chargerDonnees()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: RED, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const ouverts = rapports.filter(r => r.statut === 'ouvert').length
  const fermes = rapports.filter(r => r.statut === 'ferme').length
  const recents = rapports.slice(0, 6)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: RED }}>Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setInviteOpen(true)}
            className="flex-1 sm:flex-none text-center border border-gray-200 px-4 py-2.5 rounded-md text-sm font-bold hover:border-[#0f172a] transition-colors"
            style={{ color: RED }}
          >
            <i className="ti ti-user-plus mr-1" /> Inviter
          </button>
          <Link
            href="/superviseur/rapports-extincteurs/nouveau"
            className="flex-1 sm:flex-none text-center text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity"
            style={{ background: ACCENT }}
          >
            <i className="ti ti-plus mr-1" /> Nouveau rapport
          </Link>
        </div>
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onInvited={chargerDonnees} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Rapports ouverts', value: ouverts, icon: 'ti-file-alert', bg: '#fef2f2', color: '#dc2626' },
          { label: 'Rapports fermés', value: fermes, icon: 'ti-file-check', bg: '#f0fdf4', color: '#16a34a' },
          { label: 'Clients actifs', value: nbClients, icon: 'ti-building', bg: '#f1f5f9', color: '#0f172a' },
          { label: 'Techniciens actifs', value: nbTechniciens, icon: 'ti-tool', bg: '#fffbeb', color: '#b45309' },
          { label: 'Citoyens enregistrés', value: nbCitoyens, icon: 'ti-users', bg: '#f8fafc', color: '#475569' },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: stat.bg }}>
                <i className={`ti ${stat.icon} text-base`} style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: RED }}>{stat.value}</p>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Rapports récents */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: RED }}>Rapports récents</h2>
          <Link href="/superviseur/rapports-extincteurs" className="text-xs font-semibold hover:underline" style={{ color: ACCENT }}>
            Voir tout →
          </Link>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {recents.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-300 text-sm mb-3">Aucun rapport pour le moment</p>
              <Link href="/superviseur/rapports-extincteurs/nouveau" className="text-sm font-bold hover:underline" style={{ color: ACCENT }}>
                Créer le premier rapport →
              </Link>
            </div>
          ) : recents.map((r: any) => {
            const badge = STATUT_BADGE[r.statut] || STATUT_BADGE.ouvert
            return (
              <Link
                href={`/superviseur/rapports-extincteurs/${r.id}`}
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: RED }}>
                  <i className="ti ti-fire-extinguisher text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: RED }}>
                    {r.batiment?.adresse_complete || '—'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {r.batiment?.client_nom} · {r.techniciens?.map((t: any) => t.username).join(', ') || 'Non assigné'}
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
