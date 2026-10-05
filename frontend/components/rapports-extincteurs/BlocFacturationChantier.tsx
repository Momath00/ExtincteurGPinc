'use client'

const NAVY = '#0f172a'
const RED = '#dc2626'
// Même noir que les en-têtes de tableau, la légende et le PDF.
const NOIR = '#0a0b0d'

function Ligne({ label, valeur, fort, lien }: { label: string; valeur?: string; fort?: boolean; lien?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="w-24 flex-shrink-0 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: NOIR }}>{label}</span>
      {valeur && lien ? (
        <a href={lien} className="text-sm font-medium underline-offset-2 hover:underline break-all" style={{ color: RED }}>{valeur}</a>
      ) : (
        <span className={`text-sm break-words ${fort ? 'font-bold' : 'font-medium'}`} style={{ color: valeur ? NAVY : '#cbd5e1' }}>
          {valeur || '—'}
        </span>
      )}
    </div>
  )
}

function Carte({ icone, titre, sousTitre, children }: { icone: string; titre: string; sousTitre: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: NOIR }}>
        <i className={`ti ${icone} text-base`} style={{ color: RED }} />
        <span className="text-xs font-bold uppercase tracking-widest text-white">{titre}</span>
        <span className="text-[11px] text-white/40">/ {sousTitre}</span>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

/** « Facturer à » (le client) et « Lieu des travaux » (le bâtiment). */
export default function BlocFacturationChantier({ rapport }: { rapport: any }) {
  const bat = rapport.batiment || {}
  const c = bat.client_facturation || {}
  const tel = [c.contact_telephone, c.contact_cellulaire && `Cell. ${c.contact_cellulaire}`].filter(Boolean).join(' · ')
  const inspecteurs = (rapport.techniciens || []).map((t: any) => t.username).join(', ')
  const nb = rapport.extincteurs?.length ?? rapport.nb_extincteurs ?? 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <Carte icone="ti-file-invoice" titre="Facturer à" sousTitre="Bill to">
        <Ligne label="Nom" valeur={c.nom} fort />
        <Ligne label="Adresse" valeur={c.adresse} />
        <Ligne label="Ville" valeur={[c.ville, c.code_postal].filter(Boolean).join(', ')} />
        <Ligne label="Contact" valeur={c.contact_nom} />
        <Ligne label="Téléphone" valeur={tel} />
        <Ligne label="Courriel" valeur={c.contact_email} lien={c.contact_email ? `mailto:${c.contact_email}` : undefined} />
      </Carte>
      <Carte icone="ti-map-pin" titre="Lieu des travaux" sousTitre="Job site">
        <Ligne label="Nom" valeur={bat.nom || bat.adresse_complete} fort />
        <Ligne label="Adresse" valeur={[bat.numero_civique, bat.rue].filter(Boolean).join(' ')} />
        <Ligne label="Ville" valeur={[bat.ville, bat.province, bat.code_postal].filter(Boolean).join(', ')} />
        <Ligne label="Inspecteur" valeur={inspecteurs} />
        <Ligne label="Date" valeur={rapport.date_inspection
          ? new Date(rapport.date_inspection + 'T12:00:00').toLocaleDateString('fr-CA', { dateStyle: 'long' })
          : ''} />
        <Ligne label="Extincteurs" valeur={`${nb} extincteur${nb > 1 ? 's' : ''}`} fort />
      </Carte>
    </div>
  )
}
