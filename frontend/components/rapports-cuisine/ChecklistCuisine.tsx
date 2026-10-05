'use client'

import { useState, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

// Même liste et mêmes noms de champs que CHECKLIST_CUISINE côté backend
// (securiteincendie/inspections/views.py) et RapportCuisine.CHAMPS_VERIFICATION.
// Numérotées, avec traduction anglaise sous chaque ligne — comme le
// formulaire papier bilingue.
export const CHAMPS_VERIFICATION: { key: string; label: string; en: string }[] = [
  { key: 'appareils_proteges', label: 'Vérifier si les appareils sont protégés de façon adéquate', en: 'Check if all appliances are properly covered' },
  { key: 'liens_fusibles_remplaces', label: 'Remplacer le(s) lien(s)-fusible(s)', en: 'Replace fuse link(s)' },
  { key: 'installation_conforme_fabricant', label: 'Vérifier si le système est installé selon les normes du fabricant', en: "Check if system is installed to manufacturer's standards" },
  { key: 'cable_tension_verifie', label: 'Vérifier le câble de tension pour corrosion ou effilochure', en: 'Check tension cable for corrosion or fraying' },
  { key: 'pression_manometre_verifiee', label: 'Vérifier la pression du manomètre', en: 'Check pressure gauge' },
  { key: 'conduits_decharge_verifies', label: 'Vérifier tous les conduits de déchargement et fixations', en: 'Check all discharge piping and fixations' },
  { key: 'cylindres_supports_inspectes', label: 'Inspecter et nettoyer le(s) cylindre(s) et le(s) support(s)', en: 'Inspect and clean cylinder(s) and bracket(s)' },
  { key: 'extincteur_portatif_type_k', label: 'Vérifier la présence d’un extincteur portatif conforme (type K)', en: 'Check for the presence of a compliant portable extinguisher (type K)' },
  { key: 'station_manuelle_degagee', label: 'Vérifier l’absence d’obstruction devant la station manuelle', en: 'Check that there is no obstruction in front of the manual pull station' },
  { key: 'etiquettes_verification_apposees', label: 'Apposer les étiquettes de vérification', en: 'Affix inspection tags' },
  { key: 'buses_protecteurs_nettoyes', label: 'Nettoyer et vérifier les buses et leurs protecteurs', en: 'Clean and check nozzles and their covers' },
  { key: 'systeme_condition_normale', label: 'Laisser le système en condition d’opération normale', en: 'Leave the system in normal operating condition' },
  { key: 'liens_fusibles_nettoyes', label: 'Nettoyer et vérifier le(s) lien(s)-fusible(s)', en: 'Clean and check fuse link(s)' },
]

export default function ChecklistCuisine({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const [form, setForm] = useState<Record<string, boolean | null>>(() => {
    const init: Record<string, boolean | null> = {}
    for (const c of CHAMPS_VERIFICATION) init[c.key] = rapport[c.key] ?? true
    return init
  })
  const [commentaires, setCommentaires] = useState(rapport.commentaires || '')
  const [conformeRecommandations, setConformeRecommandations] = useState<boolean | null>(
    rapport.conforme_recommandations ?? null
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nbConformes = Object.values(form).filter(v => v === true).length
  const total = CHAMPS_VERIFICATION.length
  const conforme = nbConformes === total

  async function sauvegarder(payload: Record<string, any>) {
    setError('')
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setSaved(true)
      onRefresh()
      setTimeout(() => setSaved(false), 2000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Erreur lors de la sauvegarde.')
    }
  }

  function toggle(key: string) {
    const val = form[key] === true ? false : true
    setForm(prev => ({ ...prev, [key]: val }))
    sauvegarder({ [key]: val })
  }

  function onCommentairesChange(value: string) {
    setCommentaires(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => sauvegarder({ commentaires: value }), 600)
  }

  function definirConformeRecommandations(value: boolean) {
    setConformeRecommandations(value)
    sauvegarder({ conforme_recommandations: value })
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Liste des vérifications</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><i className="ti ti-check" /> Sauvegardé</span>}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={conforme ? { background: '#dcfce7', color: '#16a34a' } : { background: '#f1f5f9', color: '#64748b' }}
          >
            {nbConformes}/{total} conformes
          </span>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md mb-4 border border-red-100">{error}</div>}

      <div className="flex flex-col">
        {CHAMPS_VERIFICATION.map((c, i) => {
          const val = form[c.key]
          return (
            <button
              key={c.key}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(c.key)}
              className="flex items-start gap-3 py-2.5 border-b border-gray-50 text-left disabled:cursor-default w-full"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border-2"
                style={val === true ? { background: '#dcfce7', borderColor: '#16a34a' } : { background: '#fff', borderColor: '#cbd5e1' }}
              >
                {val === true && <i className="ti ti-check text-green-600 text-xs" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-sm whitespace-normal break-words" style={{ color: '#334155' }}>
                  <span className="font-bold">{i + 1}.</span> {c.label}
                </span>
                <span className="block text-xs italic whitespace-normal break-words text-gray-800 mt-0.5">{c.en}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-600 mb-1 block">Commentaires</label>
        <textarea
          disabled={readOnly}
          value={commentaires}
          onChange={e => onCommentairesChange(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-600 mb-0.5">
          À cette date, le système ci-haut mentionné a été vérifié et inspecté
        </p>
        <p className="text-[11px] italic text-gray-800 mb-2">
          On this date, the above system was tested and inspected
        </p>

        <div className="flex items-start justify-between gap-3 py-1.5">
          <span className="flex-1">
            <span className="text-sm block" style={{ color: '#334155' }}>
              Le système est conforme aux recommandations et aux standards du manufacturier, de ULC ORD 1254.6, ULC 300
            </span>
            <span className="text-xs italic block text-gray-800 mt-0.5">
              The system is in conformity with the manufacturer's recommendations and standards, and ULC ORD 1254.6, ULC 300
            </span>
          </span>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => definirConformeRecommandations(true)}
              className="w-16 h-8 rounded-md border text-xs font-bold disabled:cursor-default"
              style={conformeRecommandations === true ? { background: '#dcfce7', borderColor: '#16a34a', color: '#16a34a' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}
            >OUI / YES</button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => definirConformeRecommandations(false)}
              className="w-16 h-8 rounded-md border text-xs font-bold disabled:cursor-default"
              style={conformeRecommandations === false ? { background: '#fee2e2', borderColor: '#dc2626', color: '#dc2626' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}
            >NON / NO</button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 py-1.5">
          <span className="flex-1">
            <span className="text-sm block" style={{ color: '#334155' }}>
              Le système nécessite des modifications (voir commentaires) avec les recommandations et standards du manufacturier, de ULC ORD 1254.6, ULC 300
            </span>
            <span className="text-xs italic block text-gray-800 mt-0.5">
              The system requires modifications (see comments) with the manufacturer's recommendations and standards, and ULC ORD 1254.6, ULC 300
            </span>
          </span>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => definirConformeRecommandations(false)}
              className="w-16 h-8 rounded-md border text-xs font-bold disabled:cursor-default"
              style={conformeRecommandations === false ? { background: '#fee2e2', borderColor: '#dc2626', color: '#dc2626' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}
            >OUI / YES</button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => definirConformeRecommandations(true)}
              className="w-16 h-8 rounded-md border text-xs font-bold disabled:cursor-default"
              style={conformeRecommandations === true ? { background: '#dcfce7', borderColor: '#16a34a', color: '#16a34a' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}
            >NON / NO</button>
          </div>
        </div>

        {conformeRecommandations !== null && (
          <p className="text-xs font-semibold mt-2" style={conformeRecommandations ? { color: '#16a34a' } : { color: '#dc2626' }}>
            Le certificat sera émis comme {conformeRecommandations ? 'CONFORME' : 'NON CONFORME'}.
          </p>
        )}
      </div>
    </div>
  )
}
