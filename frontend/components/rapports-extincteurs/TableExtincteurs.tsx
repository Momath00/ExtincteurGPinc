'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

export const FORMAT_CHOICES: Record<string, string> = {
  '2.5lb': '2.5 lb',
  '5lb': '5 lb',
  '10lb': '10 lb',
  '13.25lb': '13.25 lb',
  '20lb': '20 lb',
  '2.5kg': '2.5 kg',
  '5kg': '5 kg',
  '10kg': '10 kg',
  '6L': '6 L',
  autre: 'Autre',
}

export const TYPE_CHOICES: Record<string, string> = {
  ABC: 'Poudre ABC',
  BC: 'Poudre BC',
  CO2: 'CO2',
  EAU: 'Eau',
  AFFF: 'Mousse (AFFF)',
  K: 'Produits chimiques humides (K)',
  halotron: 'Halotron',
  fe36: 'FE36',
  autre: 'Autre',
}

export const MARQUE_CHOICES: Record<string, string> = {
  amerex: 'Amerex',
  kidde: 'Kidde',
  buckeye: 'Buckeye',
  ansul: 'Ansul',
  general: 'General',
  flag: 'Flag',
  strikefirst: 'Strike First',
  autre: 'Autre',
}

const LEGENDE = [
  ['HT', "Test hydro, pour boyaux et/ou extincteurs, voir (Notes)"],
  ['T/O', 'Les extincteurs ou les boyaux ont dépassé le temps recommandé, voir (Notes)'],
  ['MQ', 'Extincteur ou boyaux manquant, doit être ajouté, voir (Notes)'],
  ['RM', 'Recommandation, voir (Notes)'],
  ['D', 'Déficience, voir (Notes)'],
  ['MT', 'Maintenance requise, voir (Notes)'],
]

// ── Année seule (AAAA) — pas de mois ni de jour ─────────────────────────────
export function YearMaskInput({
  value,
  readOnly,
  onCommit,
}: {
  value: number | string | null
  readOnly: boolean
  onCommit: (annee: number | null) => void
}) {
  const [text, setText] = useState(value ? String(value) : '')

  useEffect(() => { setText(value ? String(value) : '') }, [value])

  if (readOnly) {
    return <span className="text-xs text-gray-500">{value || '—'}</span>
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    setText(digits)
    if (digits.length === 4) onCommit(Number(digits))
    else if (digits.length === 0) onCommit(null)
  }

  function handleBlur() {
    if (text.length !== 4) setText(value ? String(value) : '')
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="AAAA"
      maxLength={4}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#dc2626] bg-white w-[60px]"
    />
  )
}

// ── Conteneur scrollable avec indicateur visuel (fondu + flèche) ────────────
export function ScrollableTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateFade() {
    const el = ref.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateFade()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(updateFade)
    ro.observe(el)
    window.addEventListener('resize', updateFade)
    return () => { ro.disconnect(); window.removeEventListener('resize', updateFade) }
  }, [children])

  return (
    <div className="relative">
      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-10 z-10"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))' }} />
          <div className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-sm animate-pulse"
            style={{ background: NAVY }}>
            <i className="ti ti-chevron-right text-white text-sm" />
          </div>
        </>
      )}
      {canScrollLeft && (
        <div className="pointer-events-none absolute top-0 left-0 bottom-0 w-10 z-10"
          style={{ background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.95))' }} />
      )}
      <div ref={ref} onScroll={updateFade} className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

// ── Ligne éditable ───────────────────────────────────────────────────────────
function LigneExtincteur({
  item,
  readOnly,
  onDeleted,
  onUpdate,
}: {
  item: any
  readOnly: boolean
  onDeleted: () => void
  onUpdate: (field: string, value: any) => void
}) {
  const [it, setIt] = useState<any>(item)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setIt(item) }, [item])

  async function patchField(field: string, value: any) {
    const token = localStorage.getItem('access_token')
    const updated = { ...it, [field]: value }
    setIt(updated)
    onUpdate(field, value)
    await fetch(`${API_URL}/api/extincteurs/${it.id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function supprimer() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/extincteurs/${it.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok || res.status === 204) onDeleted()
    setConfirmDelete(false)
  }

  const textInput = (field: string, placeholder = '', width = '') => (
    readOnly ? (
      <span className="text-xs" style={{ color: NAVY }}>{it[field] || '—'}</span>
    ) : (
      <input
        type="text"
        defaultValue={it[field] || ''}
        onBlur={e => patchField(field, e.target.value)}
        placeholder={placeholder}
        className={`${width} text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1 py-0.5`}
        style={{ color: NAVY }}
      />
    )
  )

  const yearInput = (field: string) => (
    <YearMaskInput
      value={it[field] ?? null}
      readOnly={readOnly}
      onCommit={annee => patchField(field, annee)}
    />
  )

  const isDefect = it.etat === 'D'
  const isNI = !isDefect && it.etat === 'NI'
  const isConforme = !isDefect && !isNI && it.etat === 'C'

  const etatInput = () => (
    readOnly ? (
      it.etat ? (
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            background: it.etat === 'D' ? '#fee2e2' : it.etat === 'C' ? '#dcfce7' : '#fef3c7',
            color: it.etat === 'D' ? '#dc2626' : it.etat === 'C' ? '#16a34a' : '#b45309',
          }}>
          {it.etat}
        </span>
      ) : <span className="text-gray-300 text-xs">—</span>
    ) : (
      <select
        value={it.etat || ''}
        onChange={e => patchField('etat', e.target.value || null)}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#dc2626] bg-white w-full"
      >
        <option value="">-</option>
        <option value="D">D</option>
        <option value="C">C</option>
        <option value="NI">NI</option>
      </select>
    )
  )

  const selectInput = (field: string, choices: Record<string, string>) => (
    readOnly ? (
      <span className="text-xs" style={{ color: NAVY }}>{it[field] ? choices[it[field]] || it[field] : '—'}</span>
    ) : (
      <select
        value={it[field] || ''}
        onChange={e => patchField(field, e.target.value)}
        className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#dc2626] bg-white w-full"
      >
        <option value="">—</option>
        {Object.entries(choices).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    )
  )

  return (
    <>
      <tr
        className="border-t border-gray-50 transition-colors"
        style={isDefect ? {
          background: '#fef2f2',
          borderLeft: '3px solid #ef4444',
        } : isNI ? {
          background: '#fffbeb',
          borderLeft: '3px solid #f59e0b',
        } : isConforme ? {
          background: '#f0fdf4',
          borderLeft: '3px solid #22c55e',
        } : {}}
      >
        <td className="px-2 py-2 text-center text-xs text-gray-400">{it.ordre}</td>
        <td className="px-2 py-2">{textInput('etage', 'Étage', 'w-full min-w-[70px]')}</td>
        <td className="px-2 py-2">{textInput('emplacement', 'Emplacement', 'w-full min-w-[110px]')}</td>
        <td className="px-2 py-2">{selectInput('type_extincteur', TYPE_CHOICES)}</td>
        <td className="px-2 py-2">{selectInput('format', FORMAT_CHOICES)}</td>
        <td className="px-2 py-2">{selectInput('marque', MARQUE_CHOICES)}</td>
        <td className="px-2 py-2">{yearInput('date_fabrication')}</td>
        <td className="px-2 py-2">{yearInput('prochaine_maintenance')}</td>
        <td className="px-2 py-2">{yearInput('prochain_test_hydrostatique')}</td>
        <td className="px-2 py-2">{textInput('numero_serie', 'N° série', 'w-full min-w-[100px]')}</td>
        <td className="px-2 py-2">{etatInput()}</td>
        <td className="px-2 py-2">{textInput('remarque', 'Remarque...', 'w-full min-w-[120px]')}</td>
        {!readOnly && (
          <td className="px-2 py-2 text-center">
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 transition-colors mx-auto"
            >
              <i className="ti ti-trash text-red-400 text-sm" />
            </button>
          </td>
        )}
      </tr>
      {confirmDelete && (
        <tr>
          <td colSpan={readOnly ? 12 : 13}>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 text-xs border-t border-red-100">
              <i className="ti ti-alert-circle text-red-500" />
              <span className="text-red-700 font-semibold">Supprimer cette ligne ?</span>
              <button onClick={supprimer}
                className="px-3 py-1 rounded-md bg-red-500 text-white font-bold hover:bg-red-600 transition-colors">
                Confirmer
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-md border border-gray-300 font-medium hover:bg-gray-50 transition-colors">
                Annuler
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Table principale ─────────────────────────────────────────────────────────
export default function TableExtincteurs({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const [items, setItems] = useState<any[]>(rapport.extincteurs || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => { setItems(rapport.extincteurs || []) }, [rapport])

  function updateLocal(id: number, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  const total = items.length
  const estDefectueux = (it: any) => it.etat === 'D'
  const estNonInspecte = (it: any) => !estDefectueux(it) && it.etat === 'NI'
  const defects = items.filter(estDefectueux)
  const nonInspectes = items.filter(estNonInspecte)
  const defectueux = defects.length
  const ni = nonInspectes.length
  const inspectes = total - defectueux - ni

  async function ajouterLigne() {
    setAdding(true)
    const token = localStorage.getItem('access_token')
    try {
      await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/extincteurs/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onRefresh()
    } finally { setAdding(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Légende */}
      <div className="bg-gray-50 border border-gray-100 rounded-md px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Légende</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {LEGENDE.map(([code, desc]) => (
            <div key={code} className="text-xs text-gray-500">
              <strong style={{ color: NAVY }}>{code}</strong> — {desc}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span><strong style={{ color: NAVY }}>État</strong> — D=Défectueux, C=Conforme, NI=Non inspecté</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fee2e2', border: '2px solid #ef4444' }} />
            <span className="text-red-600 font-semibold">Ligne rouge = défectueux</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }} />
            <span className="font-semibold" style={{ color: '#b45309' }}>Ligne jaune = non inspecté (NI)</span>
          </span>
        </div>
      </div>

      {/* Sommaire */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, bg: NAVY, color: '#fff', icon: 'ti-fire-extinguisher' },
          { label: 'Conformes', value: inspectes, bg: '#dcfce7', color: '#16a34a', icon: 'ti-check' },
          { label: 'Défectueux', value: defectueux, bg: defectueux > 0 ? '#fee2e2' : '#f8fafc', color: defectueux > 0 ? '#dc2626' : '#94a3b8', icon: 'ti-alert-triangle' },
          { label: 'Non inspectés', value: ni, bg: ni > 0 ? '#fef3c7' : '#f8fafc', color: ni > 0 ? '#b45309' : '#94a3b8', icon: 'ti-eye-off' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-md border border-gray-100 p-3.5 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
              <i className={`ti ${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color: NAVY }}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tableau récapitulatif des défectueux */}
      {defects.length > 0 && (
        <div className="bg-white rounded-md border border-red-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #fff5f5, #fff8f8)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                <i className="ti ti-alert-triangle text-sm" style={{ color: '#dc2626' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#dc2626' }}>
                  {defects.length} extincteur{defects.length > 1 ? 's' : ''} défectueux
                </p>
                <p className="text-xs text-red-400">Résumé des anomalies à corriger</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-50">
                  <th className="text-left px-4 py-2.5">No</th>
                  <th className="text-left px-3 py-2.5">Étage</th>
                  <th className="text-left px-3 py-2.5">Emplacement</th>
                  <th className="text-left px-3 py-2.5">Remarque</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((it: any, idx: number) => (
                  <tr key={it.id} className={`border-t border-red-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{it.ordre}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.etage || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#dc2626' }}>{it.emplacement || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.remarque || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tableau récapitulatif des non inspectés (NI) */}
      {nonInspectes.length > 0 && (
        <div className="bg-white rounded-md border overflow-hidden shadow-sm" style={{ borderColor: '#fde68a' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #fffbeb, #fffdf5)', borderColor: '#fef3c7' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                <i className="ti ti-eye-off text-sm" style={{ color: '#b45309' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#b45309' }}>
                  {nonInspectes.length} extincteur{nonInspectes.length > 1 ? 's' : ''} non inspecté{nonInspectes.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs" style={{ color: '#d0a24c' }}>Résumé des lignes au statut NI</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest bg-amber-50" style={{ color: '#d0a24c' }}>
                  <th className="text-left px-4 py-2.5">No</th>
                  <th className="text-left px-3 py-2.5">Étage</th>
                  <th className="text-left px-3 py-2.5">Emplacement</th>
                  <th className="text-left px-3 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {nonInspectes.map((it: any, idx: number) => (
                  <tr key={it.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`} style={{ borderColor: '#fef3c7' }}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{it.ordre}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">{it.etage || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#b45309' }}>{it.emplacement || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100" style={{ color: '#b45309' }}>
                        <i className="ti ti-eye-off text-[9px]" /> Non inspecté (NI)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bouton ajout */}
      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={ajouterLigne} disabled={adding}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0f172a] transition-colors disabled:opacity-50"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {adding ? 'Ajout...' : 'Ajouter une ligne'}
          </button>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            {readOnly ? 'Aucun extincteur enregistré.' : 'Aucun extincteur. Cliquez sur « Ajouter une ligne » pour commencer.'}
          </div>
        ) : (
          <ScrollableTable>
            <table className="w-full text-sm min-w-[1180px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50">
                  <th className="text-center px-2 py-2.5 w-10">No</th>
                  <th className="text-left px-2 py-2.5">Étage</th>
                  <th className="text-left px-2 py-2.5">Emplacement</th>
                  <th className="text-left px-2 py-2.5">Type</th>
                  <th className="text-left px-2 py-2.5">Format</th>
                  <th className="text-left px-2 py-2.5">Marque</th>
                  <th className="text-left px-2 py-2.5">Date fabrication</th>
                  <th className="text-left px-2 py-2.5">Prochaine maintenance</th>
                  <th className="text-left px-2 py-2.5">Prochain test hydro.</th>
                  <th className="text-left px-2 py-2.5">N° série</th>
                  <th className="text-center px-2 py-2.5" title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th>
                  <th className="text-left px-2 py-2.5">Remarque</th>
                  {!readOnly && <th className="px-2 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <LigneExtincteur
                    key={it.id}
                    item={it}
                    readOnly={readOnly}
                    onDeleted={onRefresh}
                    onUpdate={(field, value) => updateLocal(it.id, field, value)}
                  />
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </div>
    </div>
  )
}
