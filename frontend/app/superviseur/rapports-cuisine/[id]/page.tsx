'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import InfoSystemeForm from '@/components/rapports-cuisine/InfoSystemeForm'
import SchemaHottes from '@/components/rapports-cuisine/SchemaHottes'
import ChecklistCuisine from '@/components/rapports-cuisine/ChecklistCuisine'
import CertificatTab, { downloadHtml } from '@/components/rapports-cuisine/CertificatTab'
import ModalModifierRapport from '@/components/rapports/ModalModifierRapport'
import EnvoiDirectBanner from '@/components/rapports/EnvoiDirectBanner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

type OngletType = 'systeme' | 'certificat' | 'historique'

export default function SuperviseurRapportCuisineDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState<OngletType>('systeme')
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmFermer, setConfirmFermer] = useState(false)
  const [confirmRouvrir, setConfirmRouvrir] = useState(false)
  const [modalMode, setModalMode] = useState<'technicien' | 'citoyen' | null>(null)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/rapports-cuisine/${params.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        if (res.status === 404) { router.push('/superviseur/rapports-cuisine'); return null }
        return res.json()
      })
      .then(data => { if (data) { setRapport(data); setLoading(false) } })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [params.id])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function fermerRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/fermer/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmFermer(false)
    if (res.ok) {
      showToast('Rapport fermé. Certificat généré automatiquement.', 'success')
      charger()
      setOnglet('certificat')
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Erreur lors de la fermeture.', 'error')
    }
  }

  async function rouvrirRapport() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/rouvrir/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    setConfirmRouvrir(false)
    if (res.ok) {
      showToast("Le rapport est ouvert avec succès.", 'success')
      setOnglet('systeme')
      charger()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || 'Erreur lors de la réouverture.', 'error')
    }
  }

  async function envoyerCertificat() {
    setActionLoading(true)
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/envoyer-certificat/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setActionLoading(false)
    if (res.ok) {
      showToast('Certificat envoyé au citoyen.', 'success')
      charger()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error || "Erreur lors de l'envoi.", 'error')
    }
  }

  if (loading || !rapport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const estFerme = rapport.statut === 'ferme'

  const onglets: { key: OngletType; label: string; shortLabel: string }[] = [
    { key: 'systeme', label: 'Système', shortLabel: 'Système' },
    ...(estFerme && rapport.certificat ? [{ key: 'certificat' as OngletType, label: '🏆 Certificat', shortLabel: '🏆' }] : []),
    { key: 'historique', label: `Historique (${rapport.historique?.length || 0})`, shortLabel: `Hist. (${rapport.historique?.length || 0})` },
  ]

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-xl shadow-xl border px-5 py-3.5"
          style={{ borderColor: toast.type === 'success' ? '#bbf7d0' : '#fecaca' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2' }}>
            <i className={`ti ${toast.type === 'success' ? 'ti-check text-green-600' : 'ti-x text-red-500'} text-sm`} />
          </div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{toast.msg}</p>
        </div>
      )}

      <Link href="/superviseur/rapports-cuisine"
        className="text-xs text-gray-400 hover:text-[#0f172a] flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" /> Retour aux rapports
      </Link>

      <EnvoiDirectBanner
        batimentId={rapport.batiment?.id}
        cle={`${rapport.statut}-${rapport.certificat?.certificat_envoye}`}
        onEnvoye={charger}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: ORANGE }}>
            {rapport.batiment?.client_nom || '—'}
          </p>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: NAVY }}>
              {rapport.batiment?.adresse_complete}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={estFerme
                ? { background: '#e9f6f2', color: '#0d6b4f' }
                : { background: '#fff2e8', color: '#9a4a13' }}>
              {estFerme ? 'Fermé' : 'Ouvert'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {[
              rapport.numero_job ? `Job ${rapport.numero_job}` : '',
              rapport.date_inspection
                ? new Date(rapport.date_inspection).toLocaleDateString('fr-CA', { dateStyle: 'long' })
                : '',
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {!estFerme && (
            <button
              onClick={() => setConfirmFermer(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: NAVY }}
            >
              <i className="ti ti-lock" /> Fermer le rapport
            </button>
          )}

          {estFerme && rapport.citoyen && rapport.certificat && !rapport.certificat.certificat_envoye && (
            <button
              onClick={envoyerCertificat}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: ORANGE }}
            >
              <i className="ti ti-send" /> Envoyer le certificat
            </button>
          )}

          {estFerme && (
            <button
              onClick={() => setConfirmRouvrir(true)}
              disabled={actionLoading}
              className="text-sm font-bold px-4 py-2.5 rounded-md flex items-center gap-2 border-2 disabled:opacity-50 hover:bg-gray-50 transition-colors"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <i className="ti ti-lock-open" /> Rouvrir le rapport
            </button>
          )}

          {estFerme && (
            <>
              <button
                onClick={() => downloadHtml(`${API_URL}/api/rapports-cuisine/${rapport.id}/telecharger/`)}
                className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                <i className="ti ti-file-download" /> Rapport
              </button>
              {rapport.certificat ? (
                <button
                  onClick={() => downloadHtml(`${API_URL}/api/rapports-cuisine/${rapport.id}/certificat-pdf/`)}
                  className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-orange-50 transition-colors"
                  style={{ borderColor: ORANGE, color: ORANGE }}
                >
                  <i className="ti ti-certificate" /> Certificat
                </button>
              ) : rapport.rapport_extincteur_id ? (
                <button
                  onClick={() => downloadHtml(`${API_URL}/api/rapports-extincteurs/${rapport.rapport_extincteur_id}/certificat-pdf/`)}
                  className="text-sm font-bold px-4 py-2.5 rounded-md border-2 flex items-center gap-2 hover:bg-orange-50 transition-colors"
                  style={{ borderColor: ORANGE, color: ORANGE }}
                >
                  <i className="ti ti-certificate" /> Certificat unifié
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {rapport.rapport_extincteur_id && (
        <Link
          href={`/superviseur/rapports-extincteurs/${rapport.rapport_extincteur_id}`}
          className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md border text-sm hover:shadow-sm transition-shadow"
          style={{ background: '#fff2e8', borderColor: '#fde3cc' }}
        >
          <i className="ti ti-fire-extinguisher flex-shrink-0" style={{ color: ORANGE }} />
          <span className="flex-1" style={{ color: NAVY }}>
            Rapport extincteur lié — même visite, certificat unifié (pas de certificat cuisine séparé).
          </span>
          <i className="ti ti-chevron-right flex-shrink-0" style={{ color: ORANGE }} />
        </Link>
      )}

      {estFerme && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-md border text-sm"
          style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <i className="ti ti-edit text-yellow-600 flex-shrink-0" />
          <span style={{ color: '#92400e' }}>
            Rapport fermé · En tant que superviseur vous pouvez quand même modifier toutes les données.
          </span>
        </div>
      )}

      {modalMode && (
        <ModalModifierRapport
          rapport={rapport}
          mode={modalMode}
          apiBase="/api/rapports-cuisine/"
          onClose={() => setModalMode(null)}
          onSaved={() => { charger(); showToast('Modification faite avec succès', 'success') }}
        />
      )}

      <div className="bg-white rounded-md border border-gray-100 p-4 mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Techniciens</span>
        {rapport.techniciens?.length
          ? rapport.techniciens.map((t: any) => (
            <div key={t.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-3 py-1">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: NAVY }}>
                {t.username?.[0]?.toUpperCase()}
              </span>
              <span className="text-xs font-medium" style={{ color: NAVY }}>{t.username}</span>
            </div>
          ))
          : <span className="text-xs text-gray-300 italic">Aucun technicien assigné</span>}
        <button
          onClick={() => setModalMode('technicien')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#dc2626] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> Réassigner
        </button>

        <span className="w-px h-4 bg-gray-200 flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Citoyen</span>
        <span className="text-xs font-medium" style={{ color: rapport.citoyen ? NAVY : '#9ca3af' }}>
          {rapport.citoyen?.username || 'Aucun'}
        </span>
        {rapport.certificat?.certificat_envoye && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700 flex items-center gap-1">
            <i className="ti ti-check text-[10px]" /> Certificat envoyé
          </span>
        )}
        <button
          onClick={() => setModalMode('citoyen')}
          className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#dc2626] transition-colors flex items-center gap-1"
          style={{ color: NAVY }}
        >
          <i className="ti ti-edit text-[11px]" /> Réassigner
        </button>
      </div>

      <div className="flex gap-0.5 sm:gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
        {onglets.map(o => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className="px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0"
            style={{
              borderColor: onglet === o.key ? ORANGE : 'transparent',
              color: onglet === o.key ? NAVY : '#9ca3af',
            }}
          >
            <span className="sm:hidden">{o.shortLabel}</span>
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        ))}
      </div>

      {onglet === 'systeme' && (
        <div className="flex flex-col gap-6">
          <InfoSystemeForm rapport={rapport} readOnly={false} onRefresh={charger} />
          <SchemaHottes rapport={rapport} readOnly={false} onRefresh={charger} />
          <ChecklistCuisine rapport={rapport} readOnly={false} onRefresh={charger} />
        </div>
      )}

      {onglet === 'certificat' && estFerme && (
        <CertificatTab rapport={rapport} onEnvoyer={envoyerCertificat} actionLoading={actionLoading} />
      )}

      {onglet === 'historique' && (
        <div className="bg-white rounded-md border border-gray-100 p-5">
          {(!rapport.historique || rapport.historique.length === 0) ? (
            <p className="text-gray-300 text-sm text-center py-10">Aucune activité enregistrée</p>
          ) : (
            <div className="flex flex-col">
              {rapport.historique.map((h: any, i: number) => (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: ORANGE }} />
                    {i < rapport.historique.length - 1 && (
                      <span className="w-px flex-1" style={{ background: '#eef1f5' }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm" style={{ color: NAVY }}>
                      <span className="font-semibold">{h.utilisateur?.username || 'Système'}</span> — {h.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.date_heure).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmFermer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmFermer(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Fermer ce rapport ?</h3>
            <p className="text-xs text-gray-400 mb-1">
              Le rapport sera verrouillé et le certificat généré automatiquement.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              En tant que superviseur, vous pourrez toujours modifier les données après la fermeture.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFermer(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                Annuler
              </button>
              <button onClick={fermerRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? 'Fermeture...' : 'Fermer le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRouvrir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmRouvrir(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#fff2e8' }}>
              <i className="ti ti-lock-open text-xl" style={{ color: ORANGE }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: NAVY }}>Rouvrir ce rapport ?</h3>
            <p className="text-xs text-gray-400 mb-5">
              Le rapport repassera au statut « Ouvert » et pourra être modifié normalement.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRouvrir(false)}
                className="flex-1 py-2.5 rounded-md text-sm font-semibold border border-gray-200"
                style={{ color: NAVY }}>
                Annuler
              </button>
              <button onClick={rouvrirRapport} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50"
                style={{ background: NAVY }}>
                {actionLoading ? 'Réouverture...' : 'Rouvrir le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
