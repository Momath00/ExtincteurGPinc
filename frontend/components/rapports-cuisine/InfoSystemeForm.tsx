'use client'

import { useState, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'

const TYPE_AGENT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'liquide', label: 'Liquide (wet chemical)' },
  { value: 'poudre', label: 'À poudre (dry chemical)' },
  { value: 'co2', label: 'CO2' },
  { value: 'autre', label: 'Autre' },
]

const DISPOSITIF_COUPURE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'valve_gaz', label: 'Valve(s) à gaz' },
  { value: 'contacteur', label: 'Contacteur' },
]

const FABRICANT_OPTIONS = ['Kidde', 'Range Guard', 'Pyro-Chem', 'Ansul', 'Buckeye', 'Amerex']
const ALIMENTATION_OPTIONS = ['Gaz', 'Électrique']
const RACCORDEMENT_OPTIONS = ["Relié au panneau d'alarme"]

const OUI_NON_OPTIONS = [
  { value: '', label: '—' },
  { value: 'true', label: 'Oui' },
  { value: 'false', label: 'Non' },
]

const CHAMPS_TEXTE: { key: string; label: string; en: string; placeholder?: string }[] = [
  { key: 'fabricant', label: 'Fabricant', en: 'Manufacturer' },
  { key: 'modele', label: 'Modèle', en: 'Model' },
  { key: 'numero_serie', label: 'N° de série', en: 'Serial no.' },
  { key: 'buses_liens_fusibles', label: 'Buses / liens fusibles (résumé)', en: 'Nozzles / fuse links (summary)', placeholder: 'Ex. 6 buses · 360° (remplacés)' },
]

const CHAMPS_NOMBRE: { key: string; label: string; en: string }[] = [
  { key: 'nombre_buses', label: 'Nombre de buses', en: 'Number of nozzles' },
  { key: 'liens_fusibles_360f', label: 'Liens fusibles 360°F', en: 'Fuse links 360°F' },
  { key: 'liens_fusibles_450f', label: 'Liens fusibles 450°F', en: 'Fuse links 450°F' },
  { key: 'liens_fusibles_500f', label: 'Liens fusibles 500°F', en: 'Fuse links 500°F' },
]

const CHAMPS_DATE: { key: string; label: string; en: string }[] = [
  { key: 'date_inspection', label: 'Date du service', en: 'Service date' },
  { key: 'prochaine_inspection', label: 'Prochaine inspection (semi-annuelle)', en: 'Next inspection (semi-annual)' },
  { key: 'date_dernier_essai_hydrostatique', label: 'Dernier essai hydrostatique', en: 'Last hydrostatic test' },
  { key: 'date_installation', label: "Date d'installation", en: 'Installation date' },
  { key: 'date_derniere_recharge', label: 'Dernière recharge', en: 'Last recharge' },
]

// Dates saisies à l'année seulement.
const CHAMPS_ANNEE = ['date_dernier_essai_hydrostatique']

// « 2026-09-23 » → « 2027-03-23 ». Fin de mois ramenée au dernier jour
// valide (31 août → 28/29 février). null si la date est incomplète.
function plusSixMois(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [a, mo, j] = [Number(m[1]), Number(m[2]) - 1 + 6, Number(m[3])]
  const annee = a + Math.floor(mo / 12)
  const mois = mo % 12
  const dernierJour = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${annee}-${pad(mois + 1)}-${pad(Math.min(j, dernierJour))}`
}

function Label({ fr, en }: { fr: string; en: string }) {
  return (
    <label className="mb-1 block">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-600">{fr}</span>
      <span className="text-[10px] italic text-gray-500"> ({en})</span>
    </label>
  )
}

function SelectAvecAutre({
  label, labelEn, value, options, readOnly, onChange,
}: {
  label: string
  labelEn: string
  value: string
  options: string[]
  readOnly: boolean
  onChange: (v: string) => void
}) {
  const estAutre = value !== '' && !options.includes(value)
  const [autre, setAutre] = useState(estAutre)
  const selectValue = autre ? '__autre__' : value

  return (
    <div>
      <Label fr={label} en={labelEn} />
      <select
        disabled={readOnly}
        value={selectValue || ''}
        onChange={e => {
          if (e.target.value === '__autre__') { setAutre(true); onChange(''); return }
          setAutre(false)
          onChange(e.target.value)
        }}
        className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__autre__">Autre (préciser)</option>
      </select>
      {autre && (
        <input
          type="text"
          disabled={readOnly}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Préciser..."
          className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
        />
      )}
    </div>
  )
}

export default function InfoSystemeForm({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const [form, setForm] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {}
    for (const c of CHAMPS_TEXTE) init[c.key] = rapport[c.key] || ''
    for (const c of CHAMPS_NOMBRE) init[c.key] = rapport[c.key] ?? ''
    for (const c of CHAMPS_DATE) init[c.key] = rapport[c.key] || ''
    init.type_agent = rapport.type_agent || ''
    init.dispositif_coupure = rapport.dispositif_coupure || ''
    init.alimentation = rapport.alimentation || ''
    init.raccordement = rapport.raccordement || ''
    init.liens_fusibles_remplaces = rapport.liens_fusibles_remplaces === true ? 'true' : rapport.liens_fusibles_remplaces === false ? 'false' : ''
    return init
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const CHAMPS_BOOL = ['liens_fusibles_remplaces']
  const CHAMPS_DATE_KEYS = CHAMPS_DATE.map(c => c.key)
  const CHAMPS_NOMBRE_KEYS = CHAMPS_NOMBRE.map(c => c.key)

  async function sauvegarder(champ: string, valeur: any) {
    setError('')
    const token = localStorage.getItem('access_token')
    let val: any = valeur
    if (CHAMPS_DATE_KEYS.includes(champ)) val = valeur || null
    else if (CHAMPS_NOMBRE_KEYS.includes(champ)) val = valeur === '' ? null : Number(valeur)
    else if (CHAMPS_BOOL.includes(champ)) val = valeur === 'true' ? true : valeur === 'false' ? false : null
    const res = await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [champ]: val }),
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

  function setChamp(key: string, value: any, debounced = false) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (!debounced) {
      sauvegarder(key, value)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => sauvegarder(key, value), 600)
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Informations du système</h3>
        {saved && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><i className="ti ti-check" /> Sauvegardé</span>}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md mb-4 border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SelectAvecAutre
          label="Fabricant"
          labelEn="Manufacturer"
          value={form.fabricant}
          options={FABRICANT_OPTIONS}
          readOnly={readOnly}
          onChange={v => setChamp('fabricant', v, true)}
        />

        {CHAMPS_TEXTE.slice(1, 2).map(c => (
          <div key={c.key}>
            <Label fr={c.label} en={c.en} />
            <input
              type="text"
              disabled={readOnly}
              value={form[c.key]}
              placeholder={c.placeholder}
              onChange={e => setChamp(c.key, e.target.value, true)}
              className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        ))}

        <div>
          <Label fr="Type d'agent" en="Agent type" />
          <select
            disabled={readOnly}
            value={form.type_agent}
            onChange={e => setChamp('type_agent', e.target.value)}
            className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {TYPE_AGENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SelectAvecAutre
          label="Alimentation des appareils"
          labelEn="Appliance power supply"
          value={form.alimentation}
          options={ALIMENTATION_OPTIONS}
          readOnly={readOnly}
          onChange={v => setChamp('alimentation', v)}
        />

        <div>
          <Label fr="Dispositif de coupure des appareils" en="Appliance shut-off device" />
          <select
            disabled={readOnly}
            value={form.dispositif_coupure}
            onChange={e => setChamp('dispositif_coupure', e.target.value)}
            className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {DISPOSITIF_COUPURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SelectAvecAutre
          label="Raccordements auxiliaires"
          labelEn="Auxiliary connections"
          value={form.raccordement}
          options={RACCORDEMENT_OPTIONS}
          readOnly={readOnly}
          onChange={v => setChamp('raccordement', v)}
        />

        {CHAMPS_NOMBRE.map(c => (
          <div key={c.key}>
            <Label fr={c.label} en={c.en} />
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={form[c.key]}
              onChange={e => setChamp(c.key, e.target.value, true)}
              className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        ))}

        <div>
          <Label fr="Liens fusibles remplacés" en="Fuse links replaced" />
          <select
            disabled={readOnly}
            value={form.liens_fusibles_remplaces}
            onChange={e => setChamp('liens_fusibles_remplaces', e.target.value)}
            className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          >
            {OUI_NON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <Label fr={CHAMPS_TEXTE[3].label} en={CHAMPS_TEXTE[3].en} />
          <input
            type="text"
            disabled={readOnly}
            value={form.buses_liens_fusibles}
            placeholder={CHAMPS_TEXTE[3].placeholder}
            onChange={e => setChamp('buses_liens_fusibles', e.target.value, true)}
            className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {CHAMPS_DATE.map(c => (
          <div key={c.key}>
            <Label fr={c.label} en={c.en} />
            {CHAMPS_ANNEE.includes(c.key) ? (
              // Année seulement (4 chiffres) — enregistrée au 1er janvier,
              // le champ reste une date côté serveur.
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="aaaa"
                disabled={readOnly}
                value={form[c.key].slice(0, 4)}
                onChange={e => {
                  const annee = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setForm(prev => ({ ...prev, [c.key]: annee }))
                  if (annee.length === 4) sauvegarder(c.key, `${annee}-01-01`)
                  else if (annee === '') sauvegarder(c.key, '')
                }}
                className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
              />
            ) : (
            <input
              type="date"
              disabled={readOnly}
              value={form[c.key]}
              onChange={e => {
                setChamp(c.key, e.target.value)
                // Inspection semi-annuelle : la prochaine est calculée à
                // +6 mois de la date du service (modifiable ensuite).
                const suivante = c.key === 'date_inspection' ? plusSixMois(e.target.value) : null
                if (suivante) setChamp('prochaine_inspection', suivante)
              }}
              className="w-full border-2 border-gray-500 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#dc2626] disabled:bg-gray-50 disabled:text-gray-400"
            />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
