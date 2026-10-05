'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModalModifierRapport from '@/components/rapports/ModalModifierRapport'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

function RapportsCuisineListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rapports, setRapports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const initialFiltre = (searchParams.get('f') as 'tous' | 'ouvert' | 'ferme') || 'tous'
  const [filtre, setFiltre] = useState<'tous' | 'ouvert' | 'ferme'>(initialFiltre)
  const [filtreClient, setFiltreClient] = useState('')
  const [recherche, setRecherche] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [modif, setModif] = useState<{ rapport: any; mode: 'technicien' | 'adresse' | 'citoyen' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [supprimerId, setSupprimerId] = useState<number | null>(null)
  const [suppression, setSuppression] = useState(false)

  function onModifSaved() {
    setToast('Modification faite avec succès')
    setTimeout(() => setToast(null), 3000)
    charger(true)
  }

  async function supprimerRapport() {
    if (!supprimerId) return
    setSuppression(true)
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/rapports-cuisine/${supprimerId}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setSuppression(false)
    setSupprimerId(null)
    setToast('Rapport supprimé.')
    setTimeout(() => setToast(null), 3000)
    charger(true)
  }

  function charger(silent = false) {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    if (!silent) setLoading(true)
    fetch(`${API_URL}/api/rapports-cuisine/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (data) {
          setRapports(Array.isArray(data) ? data : (data.results || []))
          setLastUpdate(new Date())
        }
        if (!silent) setLoading(false)
      })
      .catch(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => {
    charger()
    timerRef.current = setInterval(() => charger(true), 30000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    const f = searchParams.get('f') as 'tous' | 'ouvert' | 'ferme' | null
    if (f && f !== filtre) setFiltre(f)
  }, [searchParams])

  const clientsUniques = Array.from(
    new Map(
      rapports
        .filter(r => r.batiment?.client)
        .map(r => [r.batiment.client, r.batiment.client_nom])
    ).entries()
  )
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  const filtered = rapports.filter(r => {
    if (filtre !== 'tous' && r.statut !== filtre) return false
    if (filtreClient && String(r.batiment?.client) !== filtreClient) return false
    if (recherche.trim()) {
      const q = recherche.toLowerCase()
      const adresse = (r.batiment?.adresse_complete || '').toLowerCase()
      const client = (r.batiment?.client_nom || '').toLowerCase()
      const techs = (r.techniciens || []).map((t: any) => t.username || '').join(' ').toLowerCase()
      if (!adresse.includes(q) && !client.includes(q) && !techs.includes(q)) return false
    }
    return true
  })

  const nbOuverts = rapports.filter(r => r.statut === 'ouvert').length
  const nbFermes = rapports.filter(r => r.statut === 'ferme').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      {modif && (
        <ModalModifierRapport
          rapport={modif.rapport}
          mode={modif.mode}
          apiBase="/api/rapports-cuisine/"
          onClose={() => setModif(null)}
          onSaved={onModifSaved}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border border-green-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-green-50">
            <i className="ti ti-check text-green-600 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Rapports cuisine</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-500 text-sm">{rapports.length} rapport{rapports.length !== 1 ? 's' : ''}</p>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-400">
              Mis à jour {lastUpdate.toLocaleTimeString('fr-CA', { timeStyle: 'short' })}
            </span>
            <button onClick={() => charger()} className="text-gray-300 hover:text-gray-500 transition-colors" title="Actualiser">
              <i className="ti ti-refresh text-sm" />
            </button>
          </div>
        </div>
        <Link
          href="/superviseur/rapports-cuisine/nouveau"
          className="text-center text-white px-4 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-plus" /> Nouveau rapport
        </Link>
      </div>

      {/* Filtres + Recherche */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-md border border-gray-100 bg-white w-full sm:w-auto">
          {([
            { key: 'tous', label: `Tous (${rapports.length})` },
            { key: 'ouvert', label: `Ouverts (${nbOuverts})` },
            { key: 'ferme', label: `Fermés / Certificats (${nbFermes})` },
          ] as { key: 'tous' | 'ouvert' | 'ferme'; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"
              style={{
                background: filtre === f.key ? NAVY : 'transparent',
                color: filtre === f.key ? '#fff' : '#6b7280',
              }}
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
            placeholder="Rechercher adresse, client..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-100 rounded-md focus:outline-none focus:border-[#dc2626] bg-white"
          />
          {recherche && (
            <button onClick={() => setRecherche('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>

        {clientsUniques.length > 0 && (
          <select
            value={filtreClient}
            onChange={e => setFiltreClient(e.target.value)}
            className="py-2 px-3 text-sm border border-gray-100 rounded-md focus:outline-none focus:border-[#dc2626] bg-white text-gray-600 sm:w-48"
          >
            <option value="">Tous les clients</option>
            {clientsUniques.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-100 p-12 text-center">
          <i className="ti ti-tools-kitchen-2 text-4xl text-gray-200" />
          <p className="mt-3 text-sm text-gray-400">
            {recherche ? 'Aucun rapport ne correspond à votre recherche.' : 'Aucun rapport pour le moment.'}
          </p>
          {!recherche && (
            <Link href="/superviseur/rapports-cuisine/nouveau"
              className="mt-4 inline-block text-sm font-bold hover:underline"
              style={{ color: ORANGE }}>
              Créer le premier rapport →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_auto_auto] gap-4 px-5 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">
            <span>Adresse</span>
            <span>Client</span>
            <span>Technicien(s)</span>
            <span>Hottes</span>
            <span>Statut</span>
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.map(r => {
              const ferme = r.statut === 'ferme'
              return (
                <Link
                  key={r.id}
                  href={`/superviseur/rapports-cuisine/${r.id}`}
                  className="flex flex-col md:grid md:grid-cols-[2fr_1.5fr_1.5fr_auto_auto] gap-2 md:gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-start md:items-center group"
                >
                  <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                    <div className="w-8 h-8 rounded-md flex-shrink-0 items-center justify-center hidden md:flex"
                      style={{ background: ferme ? '#e9f6f2' : '#fff2e8' }}>
                      <i className="ti ti-tools-kitchen-2 text-sm"
                        style={{ color: ferme ? '#0d6b4f' : '#9a4a13' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate group-hover:text-[#dc2626] transition-colors" style={{ color: NAVY }}>
                        {r.batiment?.adresse_complete || '—'}
                      </p>
                      {r.date_inspection && (
                        <p className="text-xs text-gray-400">
                          {new Date(r.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'medium' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setModif({ rapport: r, mode: 'adresse' }) }}
                      title="Corriger l'adresse"
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-[#dc2626] hover:bg-orange-50 transition-colors"
                    >
                      <i className="ti ti-pencil text-xs" />
                    </button>
                  </div>

                  <div className="hidden md:flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500 truncate">{r.batiment?.client_nom || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">
                        <i className="ti ti-user text-[10px] mr-0.5" />
                        {r.citoyen?.username || 'Aucun citoyen'}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setModif({ rapport: r, mode: 'citoyen' }) }}
                      title="Modifier le citoyen assigné"
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-[#dc2626] hover:bg-orange-50 transition-colors"
                    >
                      <i className="ti ti-pencil text-xs" />
                    </button>
                  </div>

                  <div className="hidden md:flex items-center flex-wrap gap-1">
                    {r.techniciens?.length
                      ? r.techniciens.slice(0, 2).map((t: any) => (
                        <span key={t.id} className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100" style={{ color: NAVY }}>
                          {t.username}
                        </span>
                      ))
                      : <span className="text-xs text-gray-400 italic">Non assigné</span>}
                    {(r.techniciens?.length || 0) > 2 && (
                      <span className="text-xs text-gray-400">+{r.techniciens.length - 2}</span>
                    )}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setModif({ rapport: r, mode: 'technicien' }) }}
                      title="Réassigner les techniciens"
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-[#dc2626] hover:bg-orange-50 transition-colors"
                    >
                      <i className="ti ti-pencil text-xs" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:hidden">
                    <span className="text-xs text-gray-500">{r.batiment?.client_nom || '—'}</span>
                    {r.techniciens?.length > 0 && (
                      <>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">
                          {r.techniciens.map((t: any) => t.username).join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  <span className="hidden md:inline text-xs text-gray-400">{r.nb_hottes || 0} hotte{(r.nb_hottes || 0) !== 1 ? 's' : ''}</span>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
                      style={ferme
                        ? { background: '#e9f6f2', color: '#0d6b4f' }
                        : { background: '#fff2e8', color: '#9a4a13' }}>
                      {ferme ? 'Fermé' : 'Ouvert'}
                    </span>
                    {ferme && r.certificat && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap flex items-center gap-1"
                        style={{ background: '#fffbeb', color: '#92400e' }}>
                        <i className="ti ti-certificate text-[10px]" />
                        {r.certificat.certificat_envoye ? 'Envoyé' : 'Non envoyé'}
                      </span>
                    )}
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setSupprimerId(r.id) }}
                      title="Supprimer le rapport"
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <i className="ti ti-trash text-xs" />
                    </button>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {supprimerId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSupprimerId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-alert-triangle text-red-500 text-xl" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: NAVY }}>Supprimer ce rapport ?</h3>
            <p className="text-xs text-gray-400 mb-5">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setSupprimerId(null)} className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>Annuler</button>
              <button onClick={supprimerRapport} disabled={suppression} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white bg-red-500 disabled:opacity-50">
                {suppression ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SuperviseurRapportsCuisinePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    }>
      <RapportsCuisineListContent />
    </Suspense>
  )
}
