'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { LEGENDE_NON_CONFORMITES, LIBELLE_NC, estEnDeficience } from '@/lib/nonConformites'

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

// En-tête de tableau : texte blanc en gras sur fond noir.
export const TH_ROW = 'text-[10px] font-extrabold uppercase tracking-widest text-white'
export const TH_BG = { background: '#0a0b0d' }

// ── Pastille d'un code de non-conformité ────────────────────────────────────
export function PastilleNC({ code }: { code: string }) {
  return (
    <span title={LIBELLE_NC[code] || code}
      className="inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none"
      style={{ color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca' }}>
      {code}
    </span>
  )
}

// ── Sélecteur multiple des non-conformités (légende) ───────────────────────
function SelecteurNC({
  valeur,
  readOnly,
  onChange,
}: {
  valeur: string[]
  readOnly: boolean
  onChange: (codes: string[]) => void
}) {
  // Position écran du menu — `fixed` pour ne pas être coupé par le
  // défilement horizontal du tableau.
  const [ouvert, setOuvert] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function clicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(null)
    }
    function fermer() { setOuvert(null) }
    document.addEventListener('mousedown', clicExterieur)
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => {
      document.removeEventListener('mousedown', clicExterieur)
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('resize', fermer)
    }
  }, [ouvert])

  function basculerMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (ouvert) { setOuvert(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const largeur = 256, hauteur = 13 * 34 + 16
    const top = r.bottom + 4 + hauteur > window.innerHeight ? Math.max(8, r.top - 4 - hauteur) : r.bottom + 4
    setOuvert({ top, left: Math.max(8, Math.min(r.right - largeur, window.innerWidth - largeur - 8)) })
  }

  const pastilles = valeur.length
    ? <span className="flex flex-wrap gap-1">{valeur.map(c => <PastilleNC key={c} code={c} />)}</span>
    : <span className="text-gray-300 text-xs">—</span>

  if (readOnly) return pastilles

  function basculer(code: string) {
    const suivant = valeur.includes(code) ? valeur.filter(c => c !== code) : [...valeur, code]
    onChange(LEGENDE_NON_CONFORMITES.map(l => l.code).filter(c => suivant.includes(c)))
  }

  return (
    <div ref={ref}>
      <button type="button" onClick={basculerMenu}
        className="min-w-[90px] w-full flex items-center justify-between gap-1 border-2 border-[#0a0b0d] rounded px-1.5 py-1 bg-white hover:border-[#dc2626] transition-colors">
        {pastilles}
        <i className="ti ti-chevron-down text-gray-400 text-xs flex-shrink-0" />
      </button>
      {ouvert && (
        <div className="fixed z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-100 p-1.5"
          style={{ top: ouvert.top, left: ouvert.left }}>
          <button type="button" onClick={() => { onChange([]); setOuvert(null) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 transition-colors border-b border-gray-100 mb-1">
            <span className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: valeur.length ? '#cbd5e1' : NAVY, background: valeur.length ? '#fff' : NAVY }}>
              {!valeur.length && <i className="ti ti-check text-white text-[10px]" />}
            </span>
            <span className="w-10 text-[11px] font-extrabold text-gray-400">—</span>
            <span className="text-xs font-semibold" style={{ color: NAVY }}>Aucune non-conformité</span>
          </button>
          {LEGENDE_NON_CONFORMITES.map(l => {
            const coche = valeur.includes(l.code)
            return (
              <button key={l.code} type="button" onClick={() => basculer(l.code)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 transition-colors">
                <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: coche ? '#dc2626' : '#cbd5e1', background: coche ? '#dc2626' : '#fff' }}>
                  {coche && <i className="ti ti-check text-white text-[10px]" />}
                </span>
                <span className="w-10 text-[11px] font-extrabold" style={{ color: '#dc2626' }}>{l.code}</span>
                <span className="text-xs" style={{ color: NAVY }}>{l.fr}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
      className="text-xs border-2 border-[#0a0b0d] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#dc2626] bg-white w-[60px]"
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
        className={`${width} text-xs border-2 border-[#0a0b0d] bg-white focus:outline-none focus:border-[#dc2626] rounded px-1.5 py-0.5`}
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
        className="text-sm font-extrabold border-2 border-[#0a0b0d] rounded px-1.5 py-1 focus:outline-none focus:border-[#dc2626] bg-white w-full min-w-[64px]"
        style={{ color: it.etat === 'D' ? '#dc2626' : it.etat === 'C' ? '#16a34a' : it.etat === 'NI' ? '#b45309' : '#0a0b0d' }}
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
        className="text-xs border-2 border-[#0a0b0d] rounded px-1 py-0.5 focus:outline-none focus:border-[#dc2626] bg-white w-full"
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
        <td className="px-2 py-2 font-semibold">{textInput('numero', 'N°', 'w-full min-w-[50px] font-semibold')}</td>
        <td className="px-2 py-2">{textInput('emplacement', 'Emplacement', 'w-full min-w-[170px]')}</td>
        <td className="px-2 py-2 font-mono">{textInput('code_equipement', 'ADU/EXT/F100A', 'w-full min-w-[110px] font-mono')}</td>
        <td className="px-2 py-2">
          {/* Modèle = type + format (ex. « ABC » + « 20 lb ») ; libellé d'origine dessous. */}
          <div className="flex gap-1 min-w-[170px]">
            {selectInput('type_extincteur', TYPE_CHOICES)}
            {selectInput('format', FORMAT_CHOICES)}
          </div>
          {it.modele && <span className="block text-[10px] font-semibold text-gray-500 mt-0.5 whitespace-nowrap" title="Modèle d'origine">{it.modele}</span>}
        </td>
        <td className="px-2 py-2">{yearInput('date_fabrication')}</td>
        <td className="px-2 py-2">{textInput('numero_serie', 'N° série', 'w-full min-w-[100px]')}</td>
        <td className="px-2 py-2"><div className="min-w-[120px]">{selectInput('marque', MARQUE_CHOICES)}</div></td>
        <td className="px-2 py-2">{yearInput('dernier_test_hydrostatique')}</td>
        <td className="px-2 py-2">{yearInput('prochain_test_hydrostatique')}</td>
        <td className="px-2 py-2">{yearInput('prochaine_maintenance')}</td>
        <td className="px-2 py-2">{etatInput()}</td>
        <td className="px-2 py-2">
          {/* Codes de la légende + texte libre, comme la case du formulaire Excel. */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <SelecteurNC valeur={it.non_conformites || []} readOnly={readOnly}
              onChange={codes => patchField('non_conformites', codes)} />
            {readOnly
              ? (it.remarque ? <span className="text-xs font-semibold" style={{ color: NAVY }}>{it.remarque}</span> : null)
              : textInput('remarque', 'Écrire une non-conformité…', 'w-full')}
          </div>
        </td>
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
          <td colSpan={readOnly ? 13 : 14}>
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
  onItemChange,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
  /** Remonte chaque modification à la page — l'onglet Déficiences et les
   *  compteurs restent ainsi à jour sans recharger. */
  onItemChange?: (id: number, field: string, value: any) => void
}) {
  const [items, setItems] = useState<any[]>(rapport.extincteurs || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => { setItems(rapport.extincteurs || []) }, [rapport])

  function updateLocal(id: number, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
    onItemChange?.(id, field, value)
  }

  const total = items.length
  const estDefectueux = (it: any) => it.etat === 'D'
  const estNonInspecte = (it: any) => !estDefectueux(it) && it.etat === 'NI'
  const defects = items.filter(estDefectueux)
  const nonInspectes = items.filter(estNonInspecte)
  const defectueux = defects.length
  const ni = nonInspectes.length
  // Conformes = état « C » seulement : un extincteur importé sans état n'est pas encore vérifié.
  const inspectes = items.filter((it: any) => it.etat === 'C').length

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
      <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#0a0b0d' }}>
          <i className="ti ti-list-details text-base" style={{ color: ORANGE }} />
          <span className="text-xs font-bold uppercase tracking-widest text-white">Légende des non-conformités</span>
          <span className="text-[11px] text-white/40">/ Deficiencies legend</span>
        </div>
        <div className="px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {LEGENDE_NON_CONFORMITES.map(l => (
            <div key={l.code} className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs">
              <span className="w-12 flex-shrink-0 text-center"><PastilleNC code={l.code} /></span>
              <span className="font-bold" style={{ color: '#0a0b0d' }}>{l.fr}</span>
              <span className="font-bold text-gray-500">/ {l.en}</span>
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
      </div>

      {/* Sommaire */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <th className="text-left px-3 py-2.5">Emplacement</th>
                  <th className="text-left px-3 py-2.5">Non-conformités</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((it: any, idx: number) => (
                  <tr key={it.id} className={`border-t border-red-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 font-medium">{it.ordre}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold" style={{ color: '#dc2626' }}>{it.emplacement || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {(it.non_conformites || []).length
                        ? <span className="flex flex-wrap gap-1">{it.non_conformites.map((c: string) => <PastilleNC key={c} code={c} />)}</span>
                        : <span className="text-xs text-gray-400">—</span>}
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

      <BlocsSections
        rapport={rapport}
        items={items}
        readOnly={readOnly}
        onRefresh={onRefresh}
        onUpdate={updateLocal}
        ajouterLigne={ajouterLigne}
        adding={adding}
      />
    </div>
  )
}

// ── En-tête des colonnes ────────────────────────────────────────────────────
function ThBilingue({ fr, en, titre }: { fr: string; en?: string; titre?: string }) {
  return (
    <th className="text-left px-2 py-2 align-middle" title={titre}>
      <span className="block leading-tight">{fr}</span>
      {en && <span className="block leading-tight text-[9px] font-bold text-white/60 normal-case tracking-normal">{en}</span>}
    </th>
  )
}

function EnteteColonnes({ readOnly }: { readOnly: boolean }) {
  return (
    <thead>
      <tr className={TH_ROW} style={TH_BG}>
        <th className="text-center px-2 py-2.5 w-10">No</th>
        <ThBilingue fr="Numéro" en="Number" />
        <ThBilingue fr="Emplacement" en="Location" />
        <ThBilingue fr="Équipement" />
        <ThBilingue fr="Modèle" en="Model" />
        <ThBilingue fr="Année fabrication" en="Year" />
        <ThBilingue fr="Num. de série" en="Serial Num." />
        <ThBilingue fr="Marque" en="Brand" />
        <ThBilingue fr="Dernier test hydro" en="Last test" />
        <ThBilingue fr="Prochain test hydro" en="Next test" />
        <ThBilingue fr="Prochain entret." en="Next maint." />
        <ThBilingue fr="État" en="Status" titre="D=Défectueux, C=Conforme, NI=Non inspecté" />
        <ThBilingue fr="Non-conformités" en="Deficiencies" />
        {!readOnly && <th className="px-2 py-2.5 w-10" />}
      </tr>
    </thead>
  )
}

function TableauLignes({ lignes, readOnly, onRefresh, onUpdate }: {
  lignes: any[]
  readOnly: boolean
  onRefresh: () => void
  onUpdate: (id: number, field: string, value: any) => void
}) {
  return (
    <ScrollableTable>
      <table className="w-full text-sm min-w-[1500px]">
        <EnteteColonnes readOnly={readOnly} />
        <tbody>
          {lignes.map((it: any) => (
            <LigneExtincteur
              key={it.id}
              item={it}
              readOnly={readOnly}
              onDeleted={onRefresh}
              onUpdate={(field, value) => onUpdate(it.id, field, value)}
            />
          ))}
        </tbody>
      </table>
    </ScrollableTable>
  )
}

async function appelApi(chemin: string, methode: string, corps?: any) {
  const token = localStorage.getItem('access_token')
  return fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  })
}

// ── Une section repliable ───────────────────────────────────────────────────
function SectionRepliable({
  numero,
  section,
  lignes,
  ouverte,
  onBasculer,
  readOnly,
  onRefresh,
  onUpdate,
  recherche,
}: {
  numero: string
  section: any | null
  lignes: any[]
  ouverte: boolean
  onBasculer: () => void
  readOnly: boolean
  onRefresh: () => void
  onUpdate: (id: number, field: string, value: any) => void
  recherche: string
}) {
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(section?.nom || '')
  const [note, setNote] = useState(section?.note || '')
  const [confirmSuppr, setConfirmSuppr] = useState(false)
  const [ajout, setAjout] = useState(false)

  useEffect(() => { setNom(section?.nom || ''); setNote(section?.note || '') }, [section])

  const nbDefectueux = lignes.filter(estEnDeficience).length
  const nbVerifies = lignes.filter(it => it.etat).length

  async function enregistrer() {
    if (!section || !nom.trim()) return
    const res = await appelApi(`/api/sections-extincteurs/${section.id}/`, 'PATCH', { nom: nom.trim(), note })
    if (res.ok) { setEdition(false); onRefresh() }
  }

  async function supprimer() {
    if (!section) return
    const res = await appelApi(`/api/sections-extincteurs/${section.id}/`, 'DELETE')
    if (res.ok || res.status === 204) onRefresh()
    setConfirmSuppr(false)
  }

  async function ajouterDansSection() {
    setAjout(true)
    try {
      await appelApi(`/api/rapports-extincteurs/${section?.rapport}/extincteurs/`, 'POST', section ? { section: section.id } : {})
      onRefresh()
    } finally { setAjout(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onBasculer}
          aria-expanded={ouverte}
          className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <span
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors"
            style={{ background: ouverte ? ORANGE : NAVY }}
          >
            {numero}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold line-clamp-2 break-words" style={{ color: NAVY }}>
              {section ? section.nom : 'Sans section'}
            </span>
            {section?.note && (
              <span className="flex items-center gap-1 text-xs text-amber-700 truncate" title={section.note}>
                <i className="ti ti-key flex-shrink-0" /> {section.note.split('\n')[0]}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 flex-shrink-0">
            {nbDefectueux > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: ORANGE, background: '#fee2e2' }}>
                {nbDefectueux} déf.
              </span>
            )}
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full text-white" style={{ background: NAVY }}
              title="Extincteurs dont l'état est renseigné">
              {nbVerifies}/{lignes.length}
            </span>
            <i className="ti ti-chevron-down text-xl font-bold transition-transform flex-shrink-0"
              style={{ color: NAVY, transform: ouverte ? 'rotate(180deg)' : 'none' }} />
          </span>
        </button>
        {section && !readOnly && (
          <div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-3">
            <button type="button" onClick={() => { setEdition(e => !e); if (!ouverte) onBasculer() }} title="Renommer / note d'accès"
              className="w-9 h-9 rounded-md flex items-center justify-center border-2 border-[#0a0b0d] hover:bg-gray-100 transition-colors"
              style={{ color: NAVY }}>
              <i className="ti ti-pencil text-lg" />
            </button>
            <button type="button" onClick={() => setConfirmSuppr(true)} title="Supprimer la section"
              className="w-9 h-9 rounded-md flex items-center justify-center border-2 hover:bg-red-50 transition-colors"
              style={{ color: ORANGE, borderColor: ORANGE }}>
              <i className="ti ti-trash text-lg" />
            </button>
          </div>
        )}
      </div>

      {confirmSuppr && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-red-50 text-xs border-t border-red-100">
          <i className="ti ti-alert-circle text-red-500" />
          <span className="text-red-700 font-semibold">
            Supprimer la section « {section?.nom} » ? Ses {lignes.length} extincteur{lignes.length > 1 ? 's' : ''} resteront dans le rapport, sans section.
          </span>
          <button onClick={supprimer} className="px-3 py-1 rounded-md bg-red-500 text-white font-bold hover:bg-red-600">Confirmer</button>
          <button onClick={() => setConfirmSuppr(false)} className="px-3 py-1 rounded-md border border-gray-300 font-medium hover:bg-white">Annuler</button>
        </div>
      )}

      {ouverte && (
        <div className="border-t border-gray-100">
          {edition && section && (
            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 border-b border-gray-100">
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de la section"
                className="sm:w-64 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]" />
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note d'accès (permis, personne à aviser…)"
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626]" />
              <button onClick={enregistrer} disabled={!nom.trim()}
                className="px-4 py-2 rounded-md text-sm font-bold text-white disabled:opacity-50" style={{ background: NAVY }}>
                Enregistrer
              </button>
            </div>
          )}
          {section?.note && section.note.includes('\n') && !edition && (
            <div className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 whitespace-pre-line">
              {section.note}
            </div>
          )}
          {lignes.length === 0 ? (
            <p className="text-center py-6 text-xs text-gray-400">
              {recherche ? 'Aucun extincteur ne correspond à la recherche.' : 'Aucun extincteur dans cette section.'}
            </p>
          ) : (
            <TableauLignes lignes={lignes} readOnly={readOnly} onRefresh={onRefresh} onUpdate={onUpdate} />
          )}
          {!readOnly && section && (
            <div className="px-4 py-2.5 border-t border-gray-50">
              <button onClick={ajouterDansSection} disabled={ajout}
                className="flex items-center gap-1.5 text-xs font-bold hover:underline disabled:opacity-50" style={{ color: ORANGE }}>
                <i className="ti ti-plus" /> {ajout ? 'Ajout…' : 'Ajouter un extincteur dans cette section'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Toutes les sections du rapport ──────────────────────────────────────────
function BlocsSections({
  rapport,
  items,
  readOnly,
  onRefresh,
  onUpdate,
  ajouterLigne,
  adding,
}: {
  rapport: any
  items: any[]
  readOnly: boolean
  onRefresh: () => void
  onUpdate: (id: number, field: string, value: any) => void
  ajouterLigne: () => void
  adding: boolean
}) {
  const sections: any[] = rapport.sections || []
  // Fermées par défaut — clé « aucune » pour les extincteurs sans section.
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set())
  const [recherche, setRecherche] = useState('')
  const [nouvelle, setNouvelle] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)

  const q = recherche.trim().toLowerCase()
  const correspond = (it: any) => !q || [it.numero, it.emplacement, it.code_equipement, it.numero_serie, it.remarque]
    .some(v => (v || '').toString().toLowerCase().includes(q))
  const filtres = items.filter(correspond)

  const groupes: { cle: string; section: any | null; lignes: any[] }[] = sections.map(sec => ({
    cle: String(sec.id), section: sec, lignes: filtres.filter(it => it.section === sec.id),
  }))
  const sansSection = filtres.filter(it => !it.section || !sections.some(sec => sec.id === it.section))
  if (sansSection.length || (!sections.length && items.length)) {
    groupes.push({ cle: 'aucune', section: null, lignes: sansSection })
  }
  const visibles = q ? groupes.filter(g => g.lignes.length) : groupes

  function basculer(cle: string) {
    setOuvertes(prev => {
      const s = new Set(prev)
      if (s.has(cle)) s.delete(cle)
      else s.add(cle)
      return s
    })
  }

  async function creerSection() {
    if (!nouvelle?.trim()) return
    setCreation(true)
    try {
      const res = await appelApi(`/api/rapports-extincteurs/${rapport.id}/sections/`, 'POST', { nom: nouvelle.trim() })
      if (res.ok) {
        // La nouvelle section reste fermée, comme toutes les autres.
        setNouvelle(null)
        onRefresh()
      }
    } finally { setCreation(false) }
  }

  // Sans aucune section, on garde le tableau simple d'origine.
  if (!sections.length) {
    return (
      <>
        {!readOnly && (
          <div className="flex justify-end gap-2 flex-wrap">
            <button onClick={() => setNouvelle('')}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0f172a] transition-colors"
              style={{ color: NAVY }}>
              <i className="ti ti-layout-rows" /> Ajouter une section
            </button>
            <button onClick={ajouterLigne} disabled={adding}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0f172a] transition-colors disabled:opacity-50"
              style={{ color: NAVY }}>
              <i className="ti ti-plus" /> {adding ? 'Ajout...' : 'Ajouter une ligne'}
            </button>
          </div>
        )}
        {nouvelle !== null && (
          <FormNouvelleSection valeur={nouvelle} onChange={setNouvelle} onValider={creerSection} onAnnuler={() => setNouvelle(null)} enCours={creation} />
        )}
        <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
          {items.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400">
              {readOnly ? 'Aucun extincteur enregistré.' : 'Aucun extincteur. Cliquez sur « Ajouter une ligne » pour commencer.'}
            </div>
          ) : (
            <TableauLignes lignes={items} readOnly={readOnly} onRefresh={onRefresh} onUpdate={onUpdate} />
          )}
        </div>
      </>
    )
  }

  const toutOuvert = visibles.length > 0 && visibles.every(g => ouvertes.has(g.cle))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full xl:w-96">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2" style={{ color: NAVY }} />
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher n°, emplacement, équipement…"
            className="w-full border-2 border-[#0a0b0d] rounded-md pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:border-[#dc2626]" />
        </div>
        <span className="text-xs font-semibold" style={{ color: NAVY }}>
          {sections.length} section{sections.length > 1 ? 's' : ''} · {items.length} extincteurs
        </span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button type="button"
            onClick={() => setOuvertes(toutOuvert ? new Set() : new Set(visibles.map(g => g.cle)))}
            className="flex items-center gap-1.5 border border-gray-200 px-3 py-2 rounded-md text-xs font-bold hover:border-[#0f172a] transition-colors"
            style={{ color: NAVY }}>
            <i className={`ti ${toutOuvert ? 'ti-fold' : 'ti-fold-down'}`} /> {toutOuvert ? 'Tout replier' : 'Tout déplier'}
          </button>
          {!readOnly && (
            <button type="button" onClick={() => setNouvelle('')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold text-white hover:opacity-90"
              style={{ background: NAVY }}>
              <i className="ti ti-plus" /> Ajouter une section
            </button>
          )}
        </div>
      </div>

      {nouvelle !== null && (
        <FormNouvelleSection valeur={nouvelle} onChange={setNouvelle} onValider={creerSection} onAnnuler={() => setNouvelle(null)} enCours={creation} />
      )}

      {visibles.length === 0 && (
        <p className="text-center py-8 text-sm text-gray-400">Aucun extincteur ne correspond à « {recherche} ».</p>
      )}

      {visibles.map((g, i) => (
        <SectionRepliable
          key={g.cle}
          numero={g.section ? String(i + 1) : '–'}
          section={g.section}
          lignes={g.lignes}
          // Pendant une recherche, les sections trouvées s'ouvrent seules.
          ouverte={q ? true : ouvertes.has(g.cle)}
          onBasculer={() => basculer(g.cle)}
          readOnly={readOnly}
          onRefresh={onRefresh}
          onUpdate={onUpdate}
          recherche={q}
        />
      ))}
    </div>
  )
}

function FormNouvelleSection({ valeur, onChange, onValider, onAnnuler, enCours }: {
  valeur: string
  onChange: (v: string) => void
  onValider: () => void
  onAnnuler: () => void
  enCours: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-md border-2 border-dashed" style={{ borderColor: '#fecaca', background: '#fffafa' }}>
      <input autoFocus value={valeur} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onValider(); if (e.key === 'Escape') onAnnuler() }}
        placeholder="Nom de la nouvelle section (ex. Magasin, Cafétéria, Niveau 2…)"
        className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#dc2626]" />
      <div className="flex gap-2">
        <button onClick={onValider} disabled={enCours || !valeur.trim()}
          className="px-4 py-2 rounded-md text-sm font-bold text-white disabled:opacity-50" style={{ background: ORANGE }}>
          {enCours ? 'Création…' : 'Créer la section'}
        </button>
        <button onClick={onAnnuler} className="px-4 py-2 rounded-md text-sm font-semibold border border-gray-200" style={{ color: NAVY }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
