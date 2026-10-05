'use client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

export async function downloadHtml(url: string) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return
  const html = await res.text()
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
}

export default function CertificatTab({
  rapport,
  onEnvoyer,
  actionLoading,
}: {
  rapport: any
  onEnvoyer: () => void
  actionLoading: boolean
}) {
  const cert = rapport.certificat

  if (!cert) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <i className="ti ti-certificate text-5xl text-gray-200" />
        <p className="mt-4 text-sm font-semibold text-gray-400">Aucun certificat généré pour ce rapport.</p>
        <p className="text-xs text-gray-300 mt-1">Fermez le rapport pour générer le certificat.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-8 py-10 text-center" style={{ background: 'linear-gradient(135deg,#0f172a,#000000)' }}>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-certificate text-white text-3xl" />
          </div>
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Certificat de vérification</p>
          <p className="text-white text-2xl font-bold tracking-wide">{cert.numero}</p>
          <p className="text-white/50 text-xs mt-2">Système d'extinction de cuisine</p>
        </div>

        <div className="p-6">
          <div className="flex flex-col divide-y divide-gray-50 mb-6">
            {[
              ['Adresse', rapport.batiment?.adresse_complete],
              ['Client', rapport.batiment?.client_nom],
              ["Date d'émission", new Date(cert.date_emission).toLocaleDateString('fr-CA', { dateStyle: 'long' })],
              ['Émis par', cert.emis_par?.username || '—'],
              ['Date de fermeture', rapport.date_fermeture
                ? new Date(rapport.date_fermeture).toLocaleDateString('fr-CA', { dateStyle: 'long' })
                : '—'],
              ['Techniciens', (rapport.techniciens || []).map((t: any) => t.username).join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-center py-2.5 text-sm">
                <span className="text-gray-400 font-medium">{label}</span>
                <span className="font-semibold text-right max-w-[60%]" style={{ color: NAVY }}>{value || '—'}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4 mb-5" style={{ background: cert.certificat_envoye ? '#f0fdf4' : '#fffbeb' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: cert.certificat_envoye ? '#bbf7d0' : '#fde68a' }}>
                <i className={`ti ${cert.certificat_envoye ? 'ti-check text-green-800' : 'ti-clock text-yellow-800'} text-sm`} />
              </div>
              <div>
                <p className="text-sm font-bold"
                  style={{ color: cert.certificat_envoye ? '#166534' : '#92400e' }}>
                  {cert.certificat_envoye ? 'Certificat envoyé au citoyen' : 'Pas encore envoyé'}
                </p>
                {rapport.citoyen && !cert.certificat_envoye && (
                  <p className="text-xs text-gray-500 mt-0.5">Destinataire : {rapport.citoyen.username}</p>
                )}
                {!rapport.citoyen && (
                  <p className="text-xs text-gray-400 mt-0.5">Aucun citoyen assigné au rapport</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {rapport.citoyen && !cert.certificat_envoye && (
              <button
                onClick={onEnvoyer}
                disabled={actionLoading}
                className="flex-1 text-sm font-bold px-4 py-3 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: ORANGE }}
              >
                <i className="ti ti-send" />
                {actionLoading ? 'Envoi...' : 'Envoyer au citoyen'}
              </button>
            )}
            <button
              onClick={() => downloadHtml(`${API_URL}/api/rapports-cuisine/${rapport.id}/certificat-pdf/`)}
              className="flex-1 text-sm font-bold px-4 py-3 rounded-lg border-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-download" /> Télécharger PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
