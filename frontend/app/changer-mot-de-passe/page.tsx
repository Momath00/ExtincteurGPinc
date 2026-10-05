'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const INK = '#0a0b0d'
const RED = '#e11324'

const ROUTES_PAR_ROLE: Record<string, string> = {
  superviseur: '/superviseur',
  technicien: '/technicien',
  citoyen: '/citoyen',
}

function Field({
  icon,
  toggle,
  children,
}: {
  icon: string
  toggle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <i className={`ti ${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base`} />
      {children}
      {toggle}
    </div>
  )
}

const inputClass =
  'w-full bg-white border border-gray-200 rounded-md pl-10 pr-10 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#e11324] transition-colors placeholder-gray-300'

export default function ChangerMotDePassePage() {
  const router = useRouter()

  const [ancienMdp, setAncienMdp] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmerMdp, setConfirmerMdp] = useState('')
  const [showAncien, setShowAncien] = useState(false)
  const [showNouveau, setShowNouveau] = useState(false)
  const [showConfirmer, setShowConfirmer] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nouveauMdp !== confirmerMdp) { setError('Les mots de passe ne correspondent pas.'); return }
    if (nouveauMdp.length < 8) { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return }
    if (nouveauMdp === ancienMdp) { setError('Le nouveau mot de passe doit être différent de l\'actuel.'); return }

    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) { router.push('/login'); return }

      const res = await fetch(`${API_URL}/api/changer-mot-de-passe/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ancien_mot_de_passe: ancienMdp,
          nouveau_mot_de_passe: nouveauMdp,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) {
        throw new Error(data.error || (Object.values(data) as any[])[0]?.toString() || 'Erreur lors du changement de mot de passe.')
      }

      const role = localStorage.getItem('user_role') || ''
      router.push(ROUTES_PAR_ROLE[role] || '/login')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 sm:py-16" style={{ background: INK }}>
      {/* Logo + wordmark — au-dessus de la carte */}
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <img
          src="/logo-wordmark.png"
          alt="Extincteurs Nationex"
          className="h-12 w-auto sm:h-14"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <h1 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          EXTINCTEURS <span style={{ color: RED }}>NATIONEX</span>
        </h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-white/40">
          Sécurité incendie
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-white/10 bg-white p-6 sm:p-8">
          <h2 className="mb-2 flex items-center gap-2 border-b border-gray-100 pb-4 text-sm font-bold" style={{ color: INK }}>
            <i className="ti ti-key text-base" style={{ color: RED }} />
            Nouveau mot de passe
          </h2>
          <p className="text-xs text-gray-500 mb-5 mt-3 leading-relaxed">
            Votre mot de passe est temporaire. Choisissez-en un nouveau avant de continuer.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              icon="ti-lock"
              toggle={
                <button type="button" onClick={() => setShowAncien(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                  <i className={`ti ${showAncien ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                </button>
              }
            >
              <input type={showAncien ? 'text' : 'password'} value={ancienMdp}
                onChange={e => setAncienMdp(e.target.value)}
                className={inputClass}
                placeholder="Mot de passe actuel (temporaire)" required autoFocus />
            </Field>

            <Field
              icon="ti-lock"
              toggle={
                <button type="button" onClick={() => setShowNouveau(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                  <i className={`ti ${showNouveau ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                </button>
              }
            >
              <input type={showNouveau ? 'text' : 'password'} value={nouveauMdp}
                onChange={e => setNouveauMdp(e.target.value)}
                className={inputClass}
                placeholder="Nouveau mot de passe" required />
            </Field>
            <p className="text-[11px] text-gray-400 -mt-2.5">Minimum 8 caractères.</p>

            <Field
              icon="ti-lock"
              toggle={
                <button type="button" onClick={() => setShowConfirmer(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                  <i className={`ti ${showConfirmer ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                </button>
              }
            >
              <input type={showConfirmer ? 'text' : 'password'} value={confirmerMdp}
                onChange={e => setConfirmerMdp(e.target.value)}
                className={inputClass}
                placeholder="Confirmer le nouveau mot de passe" required />
            </Field>

            <button type="submit" disabled={loading}
              className="mt-1 flex items-center justify-center gap-2.5 rounded-md py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: RED }}>
              {loading ? 'Enregistrement...' : 'Continuer →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © {new Date().getFullYear()} Extincteurs Nationex
        </p>
      </div>
    </div>
  )
}
