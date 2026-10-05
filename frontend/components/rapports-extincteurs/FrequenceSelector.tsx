'use client'

import { FREQUENCES } from '@/lib/nonConformites'

const NAVY = '#0f172a'
const RED = '#dc2626'

/** Choix Mensuelle / Annuelle — deux cartes cliquables (formulaire) ou une
 *  pastille compacte segmentée (`compact`, en-tête de rapport). */
export default function FrequenceSelector({
  valeur,
  onChange,
  readOnly = false,
  compact = false,
}: {
  valeur: string
  onChange?: (v: string) => void
  readOnly?: boolean
  compact?: boolean
}) {
  if (compact) {
    return (
      <div role="radiogroup" aria-label="Fréquence d'inspection"
        className="inline-flex items-center p-0.5 rounded-full bg-gray-100 border border-gray-200">
        {FREQUENCES.map(f => {
          const actif = valeur === f.valeur
          return (
            <button
              key={f.valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              disabled={readOnly || actif}
              onClick={() => onChange?.(f.valeur)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                actif ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              } ${readOnly && !actif ? 'opacity-40' : ''} disabled:cursor-default`}
              style={actif ? { background: RED } : undefined}
            >
              <i className={`ti ${f.icone} text-sm`} />
              {f.libelle}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Fréquence d'inspection" className="grid grid-cols-2 gap-3">
      {FREQUENCES.map(f => {
        const actif = valeur === f.valeur
        return (
          <button
            key={f.valeur}
            type="button"
            role="radio"
            aria-checked={actif}
            disabled={readOnly}
            onClick={() => onChange?.(f.valeur)}
            className={`relative flex items-center gap-2 sm:gap-3 text-left rounded-lg border-2 px-3 sm:px-4 py-3 transition-all ${
              actif ? 'shadow-md' : 'border-[#0a0b0d] hover:bg-gray-50'
            }`}
            style={actif ? { borderColor: RED, background: '#fef2f2' } : undefined}
          >
            <span
              className="hidden sm:flex w-10 h-10 rounded-lg items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: actif ? RED : '#f1f5f9' }}
            >
              <i className={`ti ${f.icone} text-lg`} style={{ color: actif ? '#fff' : '#64748b' }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold" style={{ color: NAVY }}>{f.libelle}</span>
              <span className="block text-xs text-gray-500">{f.detail}</span>
            </span>
            <span
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{ borderColor: actif ? RED : '#cbd5e1', background: actif ? RED : '#fff' }}
            >
              {actif && <i className="ti ti-check text-white text-[11px]" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
