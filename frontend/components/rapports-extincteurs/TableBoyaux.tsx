'use client'

import { useState, useEffect } from 'react'
import { YearMaskInput, ScrollableTable, TH_ROW, TH_BG } from './TableExtincteurs'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

export const LONGUEUR_CHOICES: Record<string, string> = {
  '50pi': '50 pi',
  '75pi': '75 pi',
  '100pi': '100 pi',
  autre: 'Autre',
}

// ── Ligne éditable ───────────────────────────────────────────────────────────
function LigneBoyau({
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
    await fetch(`${API_URL}/api/boyaux/${it.id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function supprimer() {
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/boyaux/${it.id}/`, {
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
        <td className="px-2 py-2">{textInput('emplacement', 'Emplacement', 'w-full min-w-[110px]')}</td>
        <td className="px-2 py-2">{selectInput('longueur', LONGUEUR_CHOICES)}</td>
        <td className="px-2 py-2">{yearInput('date_fabrication')}</td>
        <td className="px-2 py-2">{yearInput('prochain_test_hydrostatique')}</td>
        <td className="px-2 py-2">{etatInput()}</td>
        <td className="px-2 py-2">{textInput('remarque', 'Écrire une non-conformité…', 'w-full min-w-[200px]')}</td>
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
          <td colSpan={readOnly ? 7 : 8}>
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
export default function TableBoyaux({
  rapport,
  readOnly,
  onRefresh,
  onItemChange,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
  onItemChange?: (id: number, field: string, value: any) => void
}) {
  const [items, setItems] = useState<any[]>(rapport.boyaux || [])
  const [adding, setAdding] = useState(false)

  useEffect(() => { setItems(rapport.boyaux || []) }, [rapport])

  function updateLocal(id: number, field: string, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
    onItemChange?.(id, field, value)
  }

  async function ajouterLigne() {
    setAdding(true)
    const token = localStorage.getItem('access_token')
    try {
      await fetch(`${API_URL}/api/rapports-extincteurs/${rapport.id}/boyaux/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      onRefresh()
    } finally { setAdding(false) }
  }

  const total = items.length
  const defectueux = items.filter((it: any) => it.etat === 'D').length
  const ni = items.filter((it: any) => it.etat === 'NI').length
  const conformes = total - defectueux - ni

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>Boyaux d'incendie</h3>
        {!readOnly && (
          <button onClick={ajouterLigne} disabled={adding}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-md text-sm font-bold hover:border-[#0f172a] transition-colors disabled:opacity-50"
            style={{ color: NAVY }}>
            <i className="ti ti-plus" /> {adding ? 'Ajout...' : 'Ajouter un boyau'}
          </button>
        )}
      </div>

      {/* Mini sommaire */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#f1f5f9', color: NAVY }}>
            Total : {total}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
            Conformes : {conformes}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${defectueux > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
            Défectueux : {defectueux}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ni > 0 ? 'bg-amber-50' : 'bg-gray-50 text-gray-400'}`} style={ni > 0 ? { color: '#b45309' } : undefined}>
            Non inspectés : {ni}
          </span>
        </div>
      )}

      <div className="bg-white rounded-md border border-gray-100 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            {readOnly ? 'Aucun boyau enregistré.' : 'Aucun boyau. Cliquez sur « Ajouter un boyau » pour commencer.'}
          </div>
        ) : (
          <ScrollableTable>
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className={TH_ROW} style={TH_BG}>
                  <th className="text-center px-2 py-2.5 w-10">No</th>
                  <th className="text-left px-2 py-2.5">Emplacement</th>
                  <th className="text-left px-2 py-2.5">Longueur</th>
                  <th className="text-left px-2 py-2.5">Date fabrication</th>
                  <th className="text-left px-2 py-2.5">Prochain test hydro.</th>
                  <th className="text-center px-2 py-2.5" title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th>
                  <th className="text-left px-2 py-2.5">Non-conformités</th>
                  {!readOnly && <th className="px-2 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <LigneBoyau
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
