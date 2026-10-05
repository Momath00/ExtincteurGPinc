'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ROUGE = '#dc2626'

/**
 * Bannière d'envoi direct — affichée sur les pages de rapport (extincteurs,
 * éclairage, cuisine) quand le client du bâtiment est en mode « Envoi
 * direct » (pas de compte, PDF envoyés par courriel). Regroupe TOUS les
 * documents prêts du bâtiment en un seul clic, peu importe quel rapport a
 * été fermé en dernier. `cle` : change quand le rapport change (fermé,
 * rouvert…) pour recharger l'aperçu.
 */
export default function EnvoiDirectBanner({ batimentId, cle, onEnvoye }: { batimentId?: number | string | null; cle?: unknown; onEnvoye?: () => void }) {
  const [info, setInfo] = useState<{ mode_direct: boolean; contact_email: string; count: number; labels: string[] } | null>(null)
  const [envoi, setEnvoi] = useState<'idle' | 'loading' | 'succes' | 'erreur'>('idle')
  const [message, setMessage] = useState('')

  function charger() {
    if (!batimentId) return
    const token = localStorage.getItem('access_token')
    fetch(`${API_URL}/api/batiments/${batimentId}/documents-a-envoyer/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setInfo(data) })
      .catch(() => {})
  }

  useEffect(() => { charger() }, [batimentId, cle])

  async function envoyer() {
    setEnvoi('loading')
    setMessage('')
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/batiments/${batimentId}/envoyer-documents/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi.")
      setEnvoi('succes')
      setMessage(data.message)
      charger()
      onEnvoye?.()
    } catch (err: any) {
      setEnvoi('erreur')
      setMessage(err.message)
    }
  }

  // Après un envoi réussi, le compteur retombe à 0 : on garde la bannière
  // affichée le temps de montrer la confirmation.
  if (!info || !info.mode_direct || (info.count === 0 && envoi !== 'succes')) return null

  return (
    <div className="mb-4 rounded-md border-2 overflow-hidden" style={{ borderColor: ROUGE }}>
      {info.count > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5" style={{ background: '#fef2f2' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: ROUGE }}>
              <i className="ti ti-mail-forward text-white text-base" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: NAVY }}>
                {info.count} document{info.count > 1 ? 's' : ''} prêt{info.count > 1 ? 's' : ''} à envoyer — {info.labels.join(' · ')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {info.contact_email
                  ? `Le client (${info.contact_email}) recevra tout en un seul courriel, avec les rapports et certificats en PDF joints.`
                  : 'Aucun courriel de contact pour ce client — ajoutez-en un dans la fiche client.'}
              </p>
            </div>
          </div>
          <button
            onClick={envoyer}
            disabled={envoi === 'loading' || !info.contact_email}
            className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ background: ROUGE }}
          >
            <i className={`ti ${envoi === 'loading' ? 'ti-loader-2 animate-spin' : 'ti-send'}`} />
            {envoi === 'loading' ? 'Envoi… (génération des PDF)' : 'Envoyer tout par courriel'}
          </button>
        </div>
      )}
      {envoi === 'succes' && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold" style={{ background: '#dcfce7', color: '#15803d' }}>
          <i className="ti ti-check" /> {message}
        </div>
      )}
      {envoi === 'erreur' && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-t" style={{ background: '#fef2f2', color: ROUGE, borderColor: '#fecaca' }}>
          <i className="ti ti-alert-circle" /> {message}
        </div>
      )}
    </div>
  )
}
