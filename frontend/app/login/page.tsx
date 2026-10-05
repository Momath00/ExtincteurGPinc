'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const INK = '#0a0b0d'
const RED = '#e11324'

type Etape = 'login' | 'oublie_email' | 'oublie_code'

function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full animate-spin flex-shrink-0"
      style={{
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: '#fff',
      }}
    />
  )
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
  'w-full bg-white border border-gray-200 rounded-md pl-10 pr-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#e11324] transition-colors placeholder-gray-300'

export default function LoginPage() {
  const router = useRouter()
  const [etape, setEtape] = useState<Etape>('login')

  // Login
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Mot de passe oublié
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmerMdp, setConfirmerMdp] = useState('')
  const [showNvMdp, setShowNvMdp] = useState(false)
  const [showCfMdp, setShowCfMdp] = useState(false)
  const [toast, setToast] = useState('')

  function reset() {
    setError('')
    setEmail(''); setCode(''); setNouveauMdp(''); setConfirmerMdp('')
  }

  // ── Connexion + redirection vers le bon tableau de bord ──────────────────
  async function connecterEtRediriger(u: string, p: string) {
    const tokenRes = await fetch(`${API_URL}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      throw new Error(err.error || err.detail || 'Identifiants incorrects.')
    }
    const tokenData = await tokenRes.json()
    localStorage.setItem('access_token', tokenData.access)
    localStorage.setItem('refresh_token', tokenData.refresh)

    const meRes = await fetch(`${API_URL}/api/me/`, {
      headers: { Authorization: `Bearer ${tokenData.access}` },
    })
    if (!meRes.ok) throw new Error("Impossible de récupérer votre profil.")
    const user = await meRes.json()

    localStorage.setItem('user_role', user.role)
    localStorage.setItem('user_id', String(user.id))
    localStorage.setItem('user_username', user.username)

    if (user.mdp_temporaire) {
      router.push('/changer-mot-de-passe')
      return
    }

    const routesParRole: Record<string, string> = {
      superviseur: '/superviseur',
      technicien: '/technicien',
      citoyen: '/citoyen',
    }
    router.push(routesParRole[user.role] || '/')
  }

  // ── Connexion ──────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await connecterEtRediriger(username, password)
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 1 : envoyer code par email ─────────────────────────────────
  async function handleEnvoyerCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/mot-de-passe-oublie/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || 'Email introuvable')
      setEtape('oublie_code')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 2 : valider code + nouveau mot de passe ────────────────────
  async function handleReinitialiser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (nouveauMdp !== confirmerMdp) { setError('Les mots de passe ne correspondent pas'); return }
    if (nouveauMdp.length < 8) { setError('Minimum 8 caractères'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/reinitialiser-mdp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, nouveau_mot_de_passe: nouveauMdp }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || 'Erreur')

      setToast('Mot de passe mis à jour')
      setTimeout(() => setToast(''), 3000)
      try {
        await connecterEtRediriger(data.username, nouveauMdp)
      } catch {
        // Connexion automatique impossible (rare) — retour au login, username pré-rempli.
        setToast('')
        setUsername(data.username || '')
        reset()
        setEtape('login')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const headerContent = {
    login: { icon: 'ti-lock', title: 'Veuillez vous authentifier' },
    oublie_email: { icon: 'ti-mail', title: 'Mot de passe oublié' },
    oublie_code: { icon: 'ti-key', title: 'Nouveau mot de passe' },
  }[etape]

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
          <h2 className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-sm font-bold" style={{ color: INK }}>
            <i className={`ti ${headerContent.icon} text-base`} style={{ color: RED }} />
            {headerContent.title}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">
              {error}
            </div>
          )}

          {/* ── Formulaire Login ── */}
          {etape === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Field icon="ti-user">
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className={inputClass}
                  placeholder="Nom d'utilisateur" required autoComplete="username" />
              </Field>
              <Field
                icon="ti-lock"
                toggle={
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                    <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                }
              >
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="Mot de passe" required autoComplete="current-password" />
              </Field>

              <button type="button"
                onClick={() => { reset(); setEtape('oublie_email') }}
                className="self-start text-xs font-medium hover:underline" style={{ color: RED }}>
                J'ai oublié mon mot de passe
              </button>

              <button type="submit" disabled={loading}
                className="mt-1 flex items-center justify-center gap-2.5 rounded-md py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: RED }}>
                {loading ? <Spinner size={16} /> : 'Se connecter'}
              </button>
            </form>
          )}

          {/* ── Étape 1 : saisir email ── */}
          {etape === 'oublie_email' && (
            <form onSubmit={handleEnvoyerCode} className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                Entrez votre email. Un code de réinitialisation vous sera envoyé.
              </p>
              <Field icon="ti-mail">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="votre@email.com" required autoFocus autoComplete="email" />
              </Field>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center gap-2.5 rounded-md py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: RED }}>
                {loading && <Spinner size={16} />} {loading ? 'Envoi en cours...' : 'Envoyer le code'}
              </button>
              <button type="button" onClick={() => { reset(); setEtape('login') }}
                className="text-xs text-gray-400 hover:text-[#0a0b0d] transition-colors text-center">
                Retour à la connexion
              </button>
            </form>
          )}

          {/* ── Étape 2 : code + nouveau mot de passe ── */}
          {etape === 'oublie_code' && (
            <form onSubmit={handleReinitialiser} className="flex flex-col gap-4">
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                Code envoyé à <strong className="text-gray-700">{email}</strong>. Vérifiez vos emails.
              </p>
              <Field icon="ti-key">
                <input type="text" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className={`${inputClass} text-center font-mono tracking-[0.3em] font-bold uppercase`}
                  placeholder="ABC123" maxLength={6} required autoFocus autoComplete="one-time-code" />
              </Field>
              <Field
                icon="ti-lock"
                toggle={
                  <button type="button" onClick={() => setShowNvMdp(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                    <i className={`ti ${showNvMdp ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                }
              >
                <input type={showNvMdp ? 'text' : 'password'} value={nouveauMdp}
                  onChange={e => setNouveauMdp(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="Nouveau mot de passe" required autoComplete="new-password" />
              </Field>
              <Field
                icon="ti-lock"
                toggle={
                  <button type="button" onClick={() => setShowCfMdp(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0a0b0d] transition-colors">
                    <i className={`ti ${showCfMdp ? 'ti-eye-off' : 'ti-eye'} text-base`} />
                  </button>
                }
              >
                <input type={showCfMdp ? 'text' : 'password'} value={confirmerMdp}
                  onChange={e => setConfirmerMdp(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="Confirmer le mot de passe" required autoComplete="new-password" />
              </Field>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center gap-2.5 rounded-md py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: RED }}>
                {loading && <Spinner size={16} />} {loading ? 'Réinitialisation...' : 'Réinitialiser mon mot de passe'}
              </button>
              <button type="button" onClick={() => { setError(''); setEtape('oublie_email') }}
                className="text-xs text-gray-400 hover:text-[#0a0b0d] transition-colors text-center">
                Renvoyer un code
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © {new Date().getFullYear()} Extincteurs Nationex
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white rounded-md border border-green-100 px-5 py-3.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-green-50">
            <i className="ti ti-check text-green-600 text-sm" />
          </div>
          <p className="text-sm font-semibold" style={{ color: INK }}>{toast}</p>
        </div>
      )}
    </div>
  )
}
