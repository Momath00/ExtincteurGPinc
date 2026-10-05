'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

function Spinner({ size = 17 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{ width: size, height: size, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff' }}
    />
  )
}

const ROLES = [
  { value: 'technicien', label: 'Technicien', icon: 'ti-tool', desc: 'Remplit et ferme les fiches d\'inspection' },
  { value: 'superviseur', label: 'Superviseur', icon: 'ti-shield-check', desc: 'Crée les rapports, gère l\'équipe' },
  { value: 'citoyen', label: 'Citoyen', icon: 'ti-user', desc: 'Consulte son rapport et son certificat' },
]

export default function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited?: () => void }) {
  const [role, setRole] = useState('technicien')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_URL}/api/utilisateurs/inviter/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, email, role }),
      })
      const data = await res.json() as any
      if (!res.ok) {
        throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur lors de l\'invitation.')
      }
      setSuccess(data.message || 'Invitation envoyée.')
      setUsername('')
      setEmail('')
      onInvited?.()
      setTimeout(() => onClose(), 1400)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>
            Inviter un membre
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 text-xs px-4 py-2.5 rounded-md mb-4 border border-green-100">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
              Nom d'utilisateur
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="jean_dupont"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean@entreprise.com"
              className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
              Rôle
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                  style={{
                    borderColor: role === r.value ? ORANGE : '#e5e7eb',
                    background: role === r.value ? '#fef2f2' : '#fff',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: role === r.value ? ORANGE : '#f1f3f5' }}
                  >
                    <i className={`ti ${r.icon} text-base`} style={{ color: role === r.value ? '#fff' : '#6b7280' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-md p-3 flex gap-2">
            <i className="ti ti-info-circle text-sm flex-shrink-0 mt-0.5" style={{ color: NAVY }} />
            <p className="text-xs text-gray-500 leading-relaxed">
              Un mot de passe temporaire sera généré et envoyé par courriel. La personne devra le changer dès sa première connexion.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 transition-opacity flex items-center justify-center"
            style={{ background: NAVY }}
          >
            {loading ? <Spinner /> : `Inviter le ${ROLES.find(r => r.value === role)?.label.toLowerCase()}`}
          </button>
        </form>
      </div>
    </div>
  )
}