'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

export default function ContactForm() {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, message }),
      })
      const data = await res.json() as any
      if (!res.ok) {
        throw new Error(data.error || (Object.values(data) as any[])?.[0]?.toString() || 'Erreur lors de l\'envoi.')
      }
      setSuccess(true)
      setPrenom(''); setNom(''); setEmail(''); setMessage('')
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-md border border-green-100 p-10 text-center max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0fdf4' }}>
          <i className="ti ti-check text-2xl text-green-600" />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>Votre message est transmis avec succès</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Nous avons bien reçu votre message et vous avez reçu un courriel de confirmation.
          Notre équipe vous répondra dans les plus brefs délais.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="text-sm font-bold hover:opacity-70 transition-opacity"
          style={{ color: ORANGE }}
        >
          Envoyer un autre message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-md border border-gray-200 p-6 sm:p-8 max-w-xl mx-auto">
      {error && (
        <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-5 border border-red-100">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            Prénom
          </label>
          <input
            type="text" value={prenom} onChange={e => setPrenom(e.target.value)}
            placeholder="Jean" required
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
            Nom
          </label>
          <input
            type="text" value={nom} onChange={e => setNom(e.target.value)}
            placeholder="Dupont" required
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
          Email
        </label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="jean.dupont@courriel.com" required
          className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]"
        />
      </div>
      <div className="mb-6">
        <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>
          Message
        </label>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Votre message..." required rows={5} minLength={10}
          className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626] resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 hover:opacity-90 transition-opacity"
        style={{ background: NAVY }}
      >
        {loading ? 'Envoi en cours...' : 'Envoyer le message'}
      </button>
    </form>
  )
}
