'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clientColor } from '@/lib/clientColor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

function ClientModal({ client, onClose, onSaved }: { client: any; onClose: () => void; onSaved: () => void }) {
  const [nom, setNom] = useState(client?.nom || '')
  const [contactNom, setContactNom] = useState(client?.contact_nom || '')
  const [email, setEmail] = useState(client?.contact_email || '')
  const [telephone, setTelephone] = useState(client?.contact_telephone || '')
  const [adresse, setAdresse] = useState(client?.adresse || '')
  const [modeLivraison, setModeLivraison] = useState(client?.mode_livraison || 'plateforme')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      const url = client ? `${API_URL}/api/clients/${client.id}/` : `${API_URL}/api/clients/`
      const res = await fetch(url, {
        method: client ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nom, contact_nom: contactNom, contact_email: email,
          contact_telephone: telephone, adresse, mode_livraison: modeLivraison,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur.')
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            {client ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Nom de l'entreprise</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Actionéo"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" required />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Personne-ressource</label>
            <input value={contactNom} onChange={e => setContactNom(e.target.value)} placeholder="Jean Dupont"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@entreprise.com"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Téléphone</label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="514-000-0000"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Adresse</label>
            <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="123 rue Principale, Montréal, QC"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Mode de livraison des rapports</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setModeLivraison('plateforme')}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md border-2 text-left transition-colors"
                style={{ borderColor: modeLivraison === 'plateforme' ? NAVY : '#e5e7eb', background: modeLivraison === 'plateforme' ? '#f1f5f9' : '#fff' }}>
                <i className="ti ti-users text-base" style={{ color: NAVY }} />
                <span className="text-xs font-bold" style={{ color: NAVY }}>Espace client</span>
                <span className="text-[11px] text-gray-400 leading-snug">Comptes invités qui se connectent pour consulter.</span>
              </button>
              <button type="button" onClick={() => setModeLivraison('direct')}
                className="flex flex-col items-start gap-1.5 p-3 rounded-md border-2 text-left transition-colors"
                style={{ borderColor: modeLivraison === 'direct' ? ORANGE : '#e5e7eb', background: modeLivraison === 'direct' ? '#fef2f2' : '#fff' }}>
                <i className="ti ti-mail-forward text-base" style={{ color: ORANGE }} />
                <span className="text-xs font-bold" style={{ color: ORANGE }}>Envoi direct</span>
                <span className="text-[11px] text-gray-400 leading-snug">Rapports + certificat en PDF, envoyés par courriel — sans compte.</span>
              </button>
            </div>
            {modeLivraison === 'direct' && !email && (
              <p className="text-[11px] text-red-500 mt-1.5">Une adresse courriel de contact est requise pour l'envoi direct.</p>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 mt-2"
            style={{ background: ORANGE }}>
            {loading ? 'Enregistrement...' : client ? 'Enregistrer' : 'Créer le client'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ClientsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const isTechnicien = pathname?.startsWith('/technicien')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalClient, setModalClient] = useState<any>(undefined)
  const [supprimerId, setSupprimerId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [recherche, setRecherche] = useState('')
  const [filtreMode, setFiltreMode] = useState<'tous' | 'plateforme' | 'direct'>('tous')

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/clients/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setClients(Array.isArray(data) ? data : (data.results || []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  async function supprimer(id: number) {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/clients/${id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setSupprimerId(null)
    if (res.ok) {
      setSuccessMsg('Client supprimé.')
      setTimeout(() => setSuccessMsg(''), 2000)
      charger()
    } else {
      const data = await res.json().catch(() => null)
      setErrorMsg(data?.detail || "Impossible de supprimer ce client.")
      setTimeout(() => setErrorMsg(''), 4000)
    }
  }

  const visibles = clients.filter((c: any) => {
    if (filtreMode !== 'tous' && c.mode_livraison !== filtreMode) return false
    const q = recherche.trim().toLowerCase()
    if (!q) return true
    return [c.nom, c.contact_nom, c.contact_email, c.contact_telephone, c.adresse]
      .some(v => (v || '').toLowerCase().includes(q))
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border border-green-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-check text-green-600 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border border-red-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-alert-triangle text-red-500 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{errorMsg}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Clients</h1>
          <p className="text-gray-400 text-sm mt-1">{clients.length} entreprise{clients.length > 1 ? 's' : ''} cliente{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModalClient(null)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> Nouveau client
        </button>
      </div>

      {clients.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white w-full sm:w-auto">
            {([
              { key: 'tous', label: `Tous (${clients.length})` },
              { key: 'plateforme', label: `Espace client (${clients.filter((c: any) => c.mode_livraison !== 'direct').length})` },
              { key: 'direct', label: `Envoi direct (${clients.filter((c: any) => c.mode_livraison === 'direct').length})` },
            ] as { key: 'tous' | 'plateforme' | 'direct'; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFiltreMode(f.key)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
                style={{ background: filtreMode === f.key ? NAVY : 'transparent', color: filtreMode === f.key ? '#fff' : '#6b7280' }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
            <input
              type="text"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher nom, contact, courriel..."
              className="w-full pl-8 pr-8 py-2 text-sm border border-gray-100 rounded-md focus:outline-none focus:border-[#dc2626] bg-white"
            />
            {recherche && (
              <button onClick={() => setRecherche('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <i className="ti ti-x text-xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {clients.length > 0 && visibles.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 text-center py-16">
          <p className="text-gray-300 text-sm">Aucun client ne correspond à ce filtre.</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 text-center py-16">
          <p className="text-gray-300 text-sm mb-3">Aucun client pour le moment</p>
          <button onClick={() => setModalClient(null)} className="text-sm font-bold hover:underline" style={{ color: ORANGE }}>
            Créer le premier client →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibles.map((c: any) => {
            const col = clientColor(c.id)
            return (
              <div
                key={c.id}
                onClick={() => router.push(`${isTechnicien ? '/technicien' : '/superviseur'}/batiments?client=${c.id}`)}
                className="bg-white rounded-md border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md hover:border-[#dc2626] transition-all duration-200 cursor-pointer"
              >
                <i className="ti ti-building-skyscraper text-xl flex-shrink-0 mt-0.5" style={{ color: col.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{c.nom}</p>
                  {c.contact_nom && <p className="text-xs text-gray-500 mt-0.5">{c.contact_nom}</p>}
                  {c.contact_email && <p className="text-xs text-gray-400">{c.contact_email}</p>}
                  {c.contact_telephone && <p className="text-xs text-gray-400">{c.contact_telephone}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <p className="text-xs font-semibold" style={{ color: col.bg }}>{c.nb_batiments || 0} bâtiment{(c.nb_batiments || 0) > 1 ? 's' : ''}</p>
                    {c.mode_livraison === 'direct' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: ORANGE, background: '#fef2f2' }}>
                        <i className="ti ti-mail-forward text-[11px]" /> Envoi direct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-gray-500 bg-gray-100">
                        <i className="ti ti-users text-[11px]" /> Espace client
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setModalClient(c) }} className="p-2 rounded-md hover:bg-gray-100 text-gray-500" title="Modifier">
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setSupprimerId(c.id) }} className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500" title="Supprimer">
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalClient !== undefined && (
        <ClientModal client={modalClient} onClose={() => setModalClient(undefined)} onSaved={charger} />
      )}

      {supprimerId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSupprimerId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-alert-triangle text-red-500 text-xl" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>Supprimer ce client ?</h3>
            <p className="text-xs text-gray-400 mb-5">Impossible si des bâtiments lui sont encore rattachés.</p>
            <div className="flex gap-2">
              <button onClick={() => setSupprimerId(null)} className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>Annuler</button>
              <button onClick={() => supprimer(supprimerId)} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white bg-red-500">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
