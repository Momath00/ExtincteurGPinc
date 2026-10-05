'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

/**
 * Modal partagée — réassigner les techniciens, le citoyen, ou corriger
 * l'adresse d'un rapport (alarme ou extincteur), depuis la liste. Réservé au
 * superviseur (endpoint `/reassigner/` superviseur-only côté backend ; l'édition
 * d'adresse passe par `/api/batiments/{id}/`, aussi superviseur-only).
 */
export default function ModalModifierRapport({
  rapport,
  mode,
  apiBase,
  onClose,
  onSaved,
}: {
  rapport: any
  mode: 'technicien' | 'adresse' | 'citoyen'
  apiBase: string
  onClose: () => void
  onSaved: () => void
}) {
  const [techniciens, setTechniciens] = useState<any[]>([])
  const [selectedTechIds, setSelectedTechIds] = useState<number[]>((rapport.techniciens || []).map((t: any) => t.id))

  const [citoyens, setCitoyens] = useState<any[]>([])
  const [selectedCitoyenId, setSelectedCitoyenId] = useState<string>(String(rapport.citoyen?.id || ''))

  const [adresse, setAdresse] = useState({
    numero_civique: rapport.batiment?.numero_civique || '',
    rue: rapport.batiment?.rue || '',
    ville: rapport.batiment?.ville || '',
    code_postal: rapport.batiment?.code_postal || '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token}` }
    if (mode === 'technicien') {
      fetch(`${API_URL}/api/utilisateurs/?role=technicien`, { headers })
        .then(res => res.json())
        .then(data => setTechniciens(Array.isArray(data) ? data : (data.results || [])))
    } else if (mode === 'citoyen') {
      fetch(`${API_URL}/api/utilisateurs/?role=citoyen`, { headers })
        .then(res => res.json())
        .then(data => setCitoyens(Array.isArray(data) ? data : (data.results || [])))
    }
  }, [mode])

  function toggleTech(id: number) {
    setSelectedTechIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function enregistrer() {
    setSaving(true)
    setError('')
    const token = localStorage.getItem('access_token')
    try {
      if (mode === 'adresse') {
        if (!adresse.rue.trim() || !adresse.ville.trim()) {
          setError("La rue et la ville sont obligatoires.")
          return
        }
        const res = await fetch(`${API_URL}/api/batiments/${rapport.batiment.id}/`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(adresse),
        })
        if (res.ok) { onSaved(); onClose() }
        else {
          const d = await res.json().catch(() => ({})) as Record<string, any>
          const premiereErreur = (Object.values(d)[0] as any)?.[0]
          setError(d.error || premiereErreur || 'Erreur lors de la modification.')
        }
        return
      }

      const body = mode === 'technicien'
        ? { techniciens: selectedTechIds }
        : { citoyen: selectedCitoyenId ? Number(selectedCitoyenId) : null }
      const res = await fetch(`${API_URL}${apiBase}${rapport.id}/reassigner/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { onSaved(); onClose() }
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Erreur lors de la modification.') }
    } finally { setSaving(false) }
  }

  const titres = {
    technicien: 'Réassigner les techniciens',
    adresse: "Corriger l'adresse",
    citoyen: 'Modifier le citoyen assigné',
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: NAVY }}>{titres[mode]}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md mb-3 border border-red-100">{error}</div>
        )}

        {mode === 'technicien' && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              Le technicien nouvellement assigné verra automatiquement ce rapport dans sa liste.
            </p>
            {techniciens.length === 0 ? (
              <p className="text-xs text-gray-400">Aucun technicien disponible.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {techniciens.map((t: any) => {
                  const checked = selectedTechIds.includes(t.id)
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => toggleTech(t.id)}
                      className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                      style={{ borderColor: checked ? ORANGE : '#e5e7eb', background: checked ? '#fef2f2' : '#fff' }}
                    >
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                        style={{ borderColor: checked ? ORANGE : '#d1d5db', background: checked ? ORANGE : 'transparent' }}
                      >
                        {checked && <i className="ti ti-check text-white text-xs" />}
                      </span>
                      <p className="text-sm font-medium truncate" style={{ color: NAVY }}>{t.username}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {mode === 'citoyen' && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              Le citoyen assigné pourra consulter ce rapport et son certificat.
            </p>
            <select
              value={selectedCitoyenId}
              onChange={e => setSelectedCitoyenId(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
            >
              <option value="">— Aucun —</option>
              {citoyens.map((c: any) => (
                <option key={c.id} value={c.id}>{c.username} — {c.email}</option>
              ))}
            </select>
          </>
        )}

        {mode === 'adresse' && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              Corrige l'adresse de ce bâtiment — le changement s'applique à tous les rapports liés à ce bâtiment.
            </p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: NAVY }}>No civique</label>
                  <input
                    type="text"
                    value={adresse.numero_civique}
                    onChange={e => setAdresse({ ...adresse, numero_civique: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: NAVY }}>Rue</label>
                  <input
                    type="text"
                    value={adresse.rue}
                    onChange={e => setAdresse({ ...adresse, rue: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: NAVY }}>Ville</label>
                <input
                  type="text"
                  value={adresse.ville}
                  onChange={e => setAdresse({ ...adresse, ville: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: NAVY }}>Code postal</label>
                <input
                  type="text"
                  value={adresse.code_postal}
                  onChange={e => setAdresse({ ...adresse, code_postal: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-[#dc2626]"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: NAVY }}>
            Annuler
          </button>
          <button
            onClick={enregistrer}
            disabled={saving}
            className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: NAVY }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
