'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clientColor } from '@/lib/clientColor'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

const TYPE_LABELS: Record<string, string> = {
  residentiel: 'Résidentiel',
  commercial: 'Commercial',
  industriel: 'Industriel',
}

function BatimentModal({ batiment, clients, citoyens, showProprietaire, onClose, onSaved }: any) {
  const [clientId, setClientId] = useState(batiment?.client || '')
  const [numeroCivique, setNumeroCivique] = useState(batiment?.numero_civique || '')
  const [rue, setRue] = useState(batiment?.rue || '')
  const [ville, setVille] = useState(batiment?.ville || '')
  const [codePostal, setCodePostal] = useState(batiment?.code_postal || '')
  const [direction, setDirection] = useState(batiment?.direction || '')
  const [typeApplication, setTypeApplication] = useState(batiment?.type_application || 'residentiel')
  const [proprietaireId, setProprietaireId] = useState(batiment?.proprietaire?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('access_token')
      const url = batiment ? `${API_URL}/api/batiments/${batiment.id}/` : `${API_URL}/api/batiments/`
      const res = await fetch(url, {
        method: batiment ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client: Number(clientId),
          numero_civique: numeroCivique, rue, ville, code_postal: codePostal,
          direction, type_application: typeApplication,
          proprietaire_id: proprietaireId ? Number(proprietaireId) : null,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            {batiment ? 'Modifier le bâtiment' : 'Nouveau bâtiment'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} required
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]">
              <option value="">— Sélectionner —</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>No civique</label>
              <input value={numeroCivique} onChange={e => setNumeroCivique(e.target.value)} placeholder="9940" required
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Rue</label>
              <input value={rue} onChange={e => setRue(e.target.value)} placeholder="St Laurent" required
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Ville</label>
              <input value={ville} onChange={e => setVille(e.target.value)} placeholder="Montréal" required
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Code postal</label>
              <input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="H2C 2L7"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Direction / secteur</label>
              <input value={direction} onChange={e => setDirection(e.target.value)} placeholder="Secteur Nord"
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Type</label>
              <select value={typeApplication} onChange={e => setTypeApplication(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]">
                <option value="residentiel">Résidentiel</option>
                <option value="commercial">Commercial</option>
                <option value="industriel">Industriel</option>
              </select>
            </div>
          </div>

          {showProprietaire && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: NAVY }}>Citoyen propriétaire <span className="text-gray-300 normal-case font-normal">(optionnel)</span></label>
              <select value={proprietaireId} onChange={e => setProprietaireId(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]">
                <option value="">— Aucun —</option>
                {citoyens.map((c: any) => <option key={c.id} value={c.id}>{c.username} — {c.email}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 mt-2"
            style={{ background: ORANGE }}>
            {loading ? 'Enregistrement...' : batiment ? 'Enregistrer' : 'Créer le bâtiment'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function BatimentsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const isTechnicien = pathname?.startsWith('/technicien')
  const [batiments, setBatiments] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [citoyens, setCitoyens] = useState<any[]>([])
  const [filtreClient, setFiltreClient] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalBatiment, setModalBatiment] = useState<any>(undefined)
  const [supprimerId, setSupprimerId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API_URL}/api/batiments/`, { headers }),
      fetch(`${API_URL}/api/clients/`, { headers }),
      // Réservé au superviseur — un technicien n'a pas accès à la liste des
      // citoyens, donc le champ « propriétaire » reste masqué pour lui.
      isTechnicien ? Promise.resolve(null) : fetch(`${API_URL}/api/utilisateurs/?role=citoyen`, { headers }),
    ]).then(async ([bRes, cRes, citRes]) => {
      if (bRes.status === 401) { router.push('/login'); return }
      const [bData, cData, citData] = await Promise.all([
        bRes.json(), cRes.json(), citRes ? citRes.json() : Promise.resolve([]),
      ])
      setBatiments(Array.isArray(bData) ? bData : (bData.results || []))
      setClients(Array.isArray(cData) ? cData : (cData.results || []))
      setCitoyens(Array.isArray(citData) ? citData : (citData.results || []))
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    const clientParam = new URLSearchParams(window.location.search).get('client')
    if (clientParam) setFiltreClient(clientParam)
    charger()
  }, [])

  async function supprimer(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/batiments/${id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setSupprimerId(null)
    setSuccessMsg('Bâtiment supprimé.')
    setTimeout(() => setSuccessMsg(''), 2000)
    charger()
  }

  const visibles = filtreClient ? batiments.filter(b => String(b.client) === filtreClient) : batiments

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Bâtiments</h1>
          <p className="text-gray-400 text-sm mt-1">{batiments.length} adresse{batiments.length > 1 ? 's' : ''} inspectée{batiments.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModalBatiment(null)}
          disabled={clients.length === 0}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-40"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> Nouveau bâtiment
        </button>
      </div>

      {clients.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs px-4 py-3 rounded-md mb-6">
          Créez d'abord un client avant d'ajouter un bâtiment.
        </div>
      )}

      {/* Filtre par client coloré */}
      {clients.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setFiltreClient('')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{ background: !filtreClient ? NAVY : '#fff', color: !filtreClient ? '#fff' : '#6b7280', border: !filtreClient ? 'none' : '1px solid #e5e7eb' }}
          >
            Tous
          </button>
          {clients.map((c: any) => {
            const col = clientColor(c.id)
            const active = filtreClient === String(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setFiltreClient(active ? '' : String(c.id))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{ background: active ? col.bg : '#fff', color: active ? '#fff' : '#6b7280', border: active ? 'none' : '1px solid #e5e7eb' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#fff' : col.bg }} />
                {c.nom}
              </button>
            )
          })}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 text-center py-16">
          <p className="text-gray-300 text-sm">Aucun bâtiment {filtreClient ? 'pour ce client' : 'pour le moment'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibles.map((b: any) => {
            const col = clientColor(b.client)
            return (
              <div key={b.id} className="bg-white rounded-md border border-gray-100 p-4 flex items-start gap-3 hover:shadow-md hover:border-[#dc2626] transition-all duration-200">
                <i className="ti ti-building text-xl flex-shrink-0 mt-0.5" style={{ color: col.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{b.adresse_complete}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.client_nom} · {TYPE_LABELS[b.type_application]}</p>
                  {b.proprietaire && <p className="text-xs text-gray-300 mt-1">Citoyen : {b.proprietaire.username}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModalBatiment(b)} className="p-2 rounded-md hover:bg-gray-100 text-gray-500" title="Modifier">
                    <i className="ti ti-edit text-base" />
                  </button>
                  <button onClick={() => setSupprimerId(b.id)} className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-500" title="Supprimer">
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalBatiment !== undefined && (
        <BatimentModal batiment={modalBatiment} clients={clients} citoyens={citoyens} showProprietaire={!isTechnicien} onClose={() => setModalBatiment(undefined)} onSaved={charger} />
      )}

      {supprimerId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSupprimerId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-alert-triangle text-red-500 text-xl" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>Supprimer ce bâtiment ?</h3>
            <p className="text-xs text-gray-400 mb-5">Tous ses rapports seront supprimés aussi. Cette action est irréversible.</p>
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
