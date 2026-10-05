'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import FrequenceSelector from './FrequenceSelector'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const RED = '#dc2626'

type Feuille = {
  feuille: string
  nom: string
  adresse: string
  ville: string
  code_postal: string
  nb_extincteurs: number
  nb_sections: number
  nb_non_conformites: number
  sections: { nom: string; note: string; nb: number }[]
}

type Apercu = { client: Record<string, string>; feuilles: Feuille[] }

function token() {
  return localStorage.getItem('access_token') || ''
}

/** Import d'un rapport Excel « par zones » : fichier → aperçu (zones,
 *  sections, client) → création d'un rapport par zone cochée. */
export default function ImportExcelModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [etape, setEtape] = useState<'fichier' | 'options' | 'resultat'>('fichier')
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [survol, setSurvol] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [clients, setClients] = useState<any[]>([])
  const [modeClient, setModeClient] = useState<'nouveau' | 'existant'>('nouveau')
  const [clientId, setClientId] = useState('')
  const [nomClient, setNomClient] = useState('')
  const [frequence, setFrequence] = useState('mensuelle')
  const [dateInspection, setDateInspection] = useState(() => new Date().toISOString().slice(0, 10))
  const [choix, setChoix] = useState<Record<string, { importer: boolean; nom: string }>>({})
  const [deplie, setDeplie] = useState<string | null>(null)
  const [resultat, setResultat] = useState<any>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/clients/`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d) ? d : d.results || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function echap(e: KeyboardEvent) { if (e.key === 'Escape' && !chargement) onClose() }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [chargement, onClose])

  async function analyser(f: File) {
    if (!/\.xlsx?m?$/i.test(f.name)) { setErreur('Choisissez un fichier Excel (.xlsx).'); return }
    setFichier(f)
    setErreur('')
    setChargement(true)
    const fd = new FormData()
    fd.append('fichier', f)
    try {
      const res = await fetch(`${API_URL}/api/rapports-extincteurs/importer-excel/apercu/`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lecture impossible.')
      setApercu(data)
      setChoix(Object.fromEntries(data.feuilles.map((x: Feuille) => [x.feuille, { importer: true, nom: x.nom }])))
      setEtape('options')
    } catch (e: any) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function importer() {
    if (!fichier || !apercu) return
    if (modeClient === 'existant' && !clientId) { setErreur('Choisissez le client.'); return }
    if (modeClient === 'nouveau' && !nomClient.trim()) { setErreur('Indiquez le nom du client.'); return }
    setErreur('')
    setChargement(true)
    const fd = new FormData()
    fd.append('fichier', fichier)
    fd.append('options', JSON.stringify({
      client_id: modeClient === 'existant' ? Number(clientId) : null,
      nouveau_client: modeClient === 'nouveau' ? { nom: nomClient.trim() } : null,
      frequence,
      date_inspection: dateInspection || null,
      feuilles: apercu.feuilles.map(f => ({ feuille: f.feuille, ...choix[f.feuille] })),
    }))
    try {
      const res = await fetch(`${API_URL}/api/rapports-extincteurs/importer-excel/`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur pendant l'import.")
      setResultat(data)
      setEtape('resultat')
      onImported()
    } catch (e: any) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  const feuilles = apercu?.feuilles || []
  const cochees = feuilles.filter(f => choix[f.feuille]?.importer)
  const totalExt = cochees.reduce((n, f) => n + f.nb_extincteurs, 0)
  const toutCoche = cochees.length === feuilles.length
  const c = apercu?.client || {}

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/50" onClick={() => !chargement && onClose()} />
      <div className="relative bg-white rounded-2xl w-full max-w-3xl max-h-full flex flex-col shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ background: '#0a0b0d' }}>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: RED }}>
            <i className="ti ti-file-spreadsheet text-white text-lg" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Importer un fichier Excel</h2>
            <p className="text-xs text-white/50 truncate">
              {fichier ? fichier.name : 'Rapport par zones — une feuille par zone'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
            {(['fichier', 'options', 'resultat'] as const).map((e, i) => (
              <span key={e} className="flex items-center gap-1.5">
                {i > 0 && <span className="w-4 h-px bg-white/20" />}
                <span className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: etape === e ? RED : 'rgba(255,255,255,0.1)', color: etape === e ? '#fff' : undefined }}>
                  {i + 1}
                </span>
              </span>
            ))}
          </div>
          <button onClick={onClose} disabled={chargement} className="text-white/50 hover:text-white ml-2" aria-label="Fermer">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {erreur && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-md mb-4 border border-red-100">
              <i className="ti ti-alert-circle" /> {erreur}
            </div>
          )}

          {etape === 'fichier' && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
              onDragOver={e => { e.preventDefault(); setSurvol(true) }}
              onDragLeave={() => setSurvol(false)}
              onDrop={e => { e.preventDefault(); setSurvol(false); const f = e.dataTransfer.files?.[0]; if (f) analyser(f) }}
              className="flex flex-col items-center justify-center text-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors"
              style={{ borderColor: survol ? RED : '#e2e8f0', background: survol ? '#fef2f2' : '#f8fafc' }}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) analyser(f) }} />
              {chargement ? (
                <>
                  <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: RED, borderTopColor: 'transparent' }} />
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>Analyse du fichier…</p>
                </>
              ) : (
                <>
                  <span className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-sm border border-gray-100">
                    <i className="ti ti-cloud-upload text-2xl" style={{ color: RED }} />
                  </span>
                  <p className="text-sm font-bold" style={{ color: NAVY }}>Glissez le fichier Excel ici ou cliquez pour le choisir</p>
                  <p className="text-xs text-gray-400 max-w-md">
                    Chaque feuille de zone devient un rapport. Les titres de section, les notes d'accès,
                    les codes équipement et les non-conformités sont repris automatiquement.
                  </p>
                </>
              )}
            </div>
          )}

          {etape === 'options' && apercu && (
            <div className="flex flex-col gap-6">
              {/* Client */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: NAVY }}>1. Client</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(['nouveau', 'existant'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setModeClient(m)}
                      className="flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-semibold transition-colors"
                      style={{ borderColor: modeClient === m ? RED : '#0a0b0d', background: modeClient === m ? '#fef2f2' : '#fff', color: NAVY }}>
                      <i className={`ti ${m === 'nouveau' ? 'ti-user-plus' : 'ti-building'}`} style={{ color: modeClient === m ? RED : '#94a3b8' }} />
                      {m === 'nouveau' ? 'Nouveau client' : 'Client existant'}
                    </button>
                  ))}
                </div>
                {modeClient === 'existant' ? (
                  <select value={clientId} onChange={e => setClientId(e.target.value)}
                    className="w-full border-2 border-[#0a0b0d] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]">
                    <option value="">— Sélectionner —</option>
                    {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
                  </select>
                ) : (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <input value={nomClient} onChange={e => setNomClient(e.target.value)} autoFocus
                      placeholder="Nom de l'entreprise (ex. Rio Tinto Fer et Titane)"
                      className="w-full border-2 border-[#0a0b0d] rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#dc2626] mb-2" />
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Repris du fichier</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs" style={{ color: NAVY }}>
                      <span><i className="ti ti-map-pin text-gray-400 mr-1" />{[c.adresse, c.ville, c.code_postal].filter(Boolean).join(', ') || '—'}</span>
                      <span><i className="ti ti-user text-gray-400 mr-1" />{c.contact_nom || '—'}</span>
                      <span><i className="ti ti-phone text-gray-400 mr-1" />{c.contact_telephone || '—'}</span>
                      <span className="truncate"><i className="ti ti-mail text-gray-400 mr-1" />{c.contact_email || '—'}</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Fréquence + date */}
              <section className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: NAVY }}>2. Fréquence d'inspection</h3>
                  <FrequenceSelector valeur={frequence} onChange={setFrequence} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: NAVY }}>Date</h3>
                  <input type="date" value={dateInspection} onChange={e => setDateInspection(e.target.value)}
                    className="border-2 border-[#0a0b0d] rounded-md px-3 py-[15px] text-sm focus:outline-none focus:border-[#dc2626]" />
                </div>
              </section>

              {/* Zones */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                    3. Zones à importer <span className="text-gray-400 normal-case font-normal">— un rapport par zone</span>
                  </h3>
                  <button type="button" className="text-xs font-semibold hover:underline" style={{ color: RED }}
                    onClick={() => setChoix(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, importer: !toutCoche }])))}>
                    {toutCoche ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                </div>
                <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {feuilles.map(f => {
                    const ch = choix[f.feuille] || { importer: false, nom: f.nom }
                    const ouvert = deplie === f.feuille
                    return (
                      <div key={f.feuille} className={ch.importer ? 'bg-white' : 'bg-gray-50'}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <button type="button" aria-label={ch.importer ? 'Ne pas importer' : 'Importer'}
                            onClick={() => setChoix(p => ({ ...p, [f.feuille]: { ...ch, importer: !ch.importer } }))}
                            className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                            style={{ borderColor: ch.importer ? RED : '#cbd5e1', background: ch.importer ? RED : '#fff' }}>
                            {ch.importer && <i className="ti ti-check text-white text-xs" />}
                          </button>
                          <input value={ch.nom} disabled={!ch.importer}
                            onChange={e => setChoix(p => ({ ...p, [f.feuille]: { ...ch, nom: e.target.value } }))}
                            className="flex-1 min-w-[90px] text-sm font-bold bg-transparent border-b border-transparent focus:border-[#dc2626] focus:outline-none disabled:text-gray-400"
                            style={{ color: ch.importer ? NAVY : undefined }} />
                          <span className="hidden sm:block min-w-0 flex-shrink text-xs font-semibold truncate max-w-[180px]" style={{ color: '#0a0b0d' }} title={f.adresse}>{f.adresse}</span>
                          <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: '#0a0b0d' }}>
                            {f.nb_extincteurs} ext.
                          </span>
                          {f.nb_non_conformites > 0 && (
                            <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: RED, background: '#fee2e2' }}
                              title="Extincteurs avec une non-conformité ou un commentaire">
                              {f.nb_non_conformites} NC
                            </span>
                          )}
                          <button type="button" onClick={() => setDeplie(ouvert ? null : f.feuille)}
                            className="flex-shrink-0 text-xs font-semibold hover:underline flex items-center gap-1 whitespace-nowrap" style={{ color: '#0a0b0d' }}>
                            {f.nb_sections} section{f.nb_sections > 1 ? 's' : ''}
                            <i className="ti ti-chevron-down transition-transform" style={{ transform: ouvert ? 'rotate(180deg)' : 'none' }} />
                          </button>
                        </div>
                        {ouvert && (
                          <ul className="px-11 pb-3 flex flex-col gap-1">
                            {f.sections.map((s, i) => (
                              <li key={i} className="text-xs">
                                <span className="font-semibold" style={{ color: NAVY }}>{s.nom}</span>
                                <span className="font-semibold" style={{ color: '#0a0b0d' }}> · {s.nb} ext.</span>
                                {s.note && <span className="block text-gray-700 italic truncate">{s.note}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {etape === 'resultat' && resultat && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <span className="w-14 h-14 rounded-full flex items-center justify-center bg-green-50">
                <i className="ti ti-circle-check text-3xl text-green-600" />
              </span>
              <p className="text-base font-bold" style={{ color: NAVY }}>
                {resultat.rapports.length} rapport{resultat.rapports.length > 1 ? 's' : ''} créé{resultat.rapports.length > 1 ? 's' : ''} pour {resultat.client.nom}
              </p>
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-left">
                {resultat.rapports.map((r: any) => (
                  <Link key={r.id} href={`/superviseur/rapports-extincteurs/${r.id}`}
                    className="flex items-center gap-3 rounded-md border border-gray-100 px-3 py-2.5 hover:border-[#dc2626] transition-colors">
                    <i className="ti ti-fire-extinguisher" style={{ color: RED }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate" style={{ color: NAVY }}>{r.nom}</span>
                      <span className="block text-xs text-gray-400">{r.nb_extincteurs} extincteurs · {r.nb_sections} sections</span>
                    </span>
                    <i className="ti ti-chevron-right text-gray-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pied */}
        {etape !== 'fichier' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            {etape === 'options' ? (
              <>
                <button type="button" onClick={() => { setEtape('fichier'); setApercu(null); setFichier(null) }} disabled={chargement}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-800">
                  <i className="ti ti-arrow-left" /> Autre fichier
                </button>
                <button type="button" onClick={importer} disabled={chargement || !cochees.length}
                  className="text-sm font-bold px-5 py-2.5 rounded-md text-white flex items-center gap-2 disabled:opacity-50"
                  style={{ background: RED }}>
                  {chargement
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Import en cours…</>
                    : <><i className="ti ti-download" /> Importer {cochees.length} zone{cochees.length > 1 ? 's' : ''} · {totalExt} extincteurs</>}
                </button>
              </>
            ) : (
              <button type="button" onClick={onClose}
                className="ml-auto text-sm font-bold px-5 py-2.5 rounded-md text-white" style={{ background: NAVY }}>
                Terminer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
