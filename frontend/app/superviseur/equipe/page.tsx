'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InviteModal from '@/components/dashboard/InviteModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  technicien: { label: 'Technicien', bg: '#fff2e8', color: '#9a4a13' },
  citoyen: { label: 'Citoyen', bg: '#eef1f5', color: '#4b5a6a' },
  superviseur: { label: 'Superviseur', bg: '#fdf0e4', color: '#c2410c' },
}

const ROLES: { value: string; label: string; icon: string; desc: string }[] = [
  { value: 'technicien', label: 'Technicien', icon: 'ti-tool', desc: 'Remplit et ferme les rapports d’inspection.' },
  { value: 'superviseur', label: 'Superviseur', icon: 'ti-shield-check', desc: 'Crée les rapports, gère l’équipe.' },
  { value: 'citoyen', label: 'Citoyen', icon: 'ti-user', desc: 'Consulte ses rapports et certificats.' },
]

const CHAMP = 'w-full border-2 border-gray-400 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2626]'

// Modifier un membre — le serveur l'avise par courriel des champs changés.
function EditModal({ membre, onClose, onSaved }: { membre: any; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(membre.role)
  const [username, setUsername] = useState(membre.username || '')
  const [email, setEmail] = useState(membre.email || '')
  const [firstName, setFirstName] = useState(membre.first_name || '')
  const [lastName, setLastName] = useState(membre.last_name || '')
  const [telephone, setTelephone] = useState(membre.telephone || '')
  const [permisRecq, setPermisRecq] = useState(membre.permis_recq || '')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`${API_URL}/api/utilisateurs/${membre.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username, email, role, first_name: firstName, last_name: lastName,
          telephone, permis_recq: role === 'technicien' ? permisRecq : '',
        }),
      })
      const data = await res.json().catch(() => ({})) as any
      if (!res.ok) throw new Error(data.error || (Object.values(data) as any[])?.[0]?.[0] || 'Erreur lors de la modification.')
      onSaved()
      onClose()
    } catch (err: any) {
      setErreur(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: NAVY }}>Modifier le membre</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><i className="ti ti-x text-lg" /></button>
        </div>

        {erreur && <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-md mb-4 border border-red-100">{erreur}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Nom d'utilisateur</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required className={CHAMP} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Prénom</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Nom</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className={CHAMP} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={CHAMP} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Téléphone</label>
            <input value={telephone} onChange={e => setTelephone(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Rôle</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(ro => (
                <button key={ro.value} type="button" onClick={() => setRole(ro.value)}
                  className="flex items-center gap-3 p-3 rounded-md border-2 text-left transition-colors"
                  style={{ borderColor: role === ro.value ? ORANGE : '#e5e7eb', background: role === ro.value ? '#fef2f2' : '#fff' }}>
                  <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: role === ro.value ? ORANGE : '#f1f3f5' }}>
                    <i className={`ti ${ro.icon} text-base`} style={{ color: role === ro.value ? '#fff' : '#6b7280' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{ro.label}</p>
                    <p className="text-xs text-gray-400 truncate">{ro.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {role === 'technicien' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: NAVY }}>Permis R.E.C.Q.</label>
              <input value={permisRecq} onChange={e => setPermisRecq(e.target.value)} className={CHAMP} />
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 rounded-md p-3 flex gap-2">
            <i className="ti ti-info-circle text-sm flex-shrink-0 mt-0.5" style={{ color: NAVY }} />
            <p className="text-xs text-gray-500 leading-relaxed">Le membre recevra un courriel listant les changements apportés à son profil.</p>
          </div>

          <button type="submit" disabled={loading}
            className="text-white py-3 rounded-md text-sm font-bold uppercase tracking-widest disabled:opacity-50 hover:opacity-90"
            style={{ background: ORANGE }}>
            {loading ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function EquipePage() {
  const router = useRouter()
  const [membres, setMembres] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'tous' | 'technicien' | 'citoyen' | 'superviseur'>('tous')
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMembre, setEditingMembre] = useState<any>(null)

  function charger() {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }
    fetch(`${API_URL}/api/utilisateurs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        const liste = Array.isArray(data) ? data : (data.results || [])
        setMembres(liste)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  async function toggleActif(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/utilisateurs/${id}/desactiver/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    charger()
  }

  const techniciens = membres.filter(m => m.role === 'technicien')
  const citoyens = membres.filter(m => m.role === 'citoyen')
  const superviseurs = membres.filter(m => m.role === 'superviseur')
  const inactifs = membres.filter(m => !m.est_actif)
  const visibles = filtre === 'tous' ? membres : membres.filter(m => m.role === filtre)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: NAVY, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Équipe</h1>
          <p className="text-gray-400 text-sm mt-1">{membres.length} membre{membres.length > 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="text-white px-5 py-2.5 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
          style={{ background: ORANGE }}
        >
          <i className="ti ti-user-plus" /> Inviter
        </button>
      </div>

      {/* Stats — pas de limites, juste des compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { key: 'tous', label: 'Total actifs', value: membres.filter(m => m.est_actif).length, icon: 'ti-users' },
          { key: 'superviseur', label: 'Superviseurs', value: superviseurs.length, icon: 'ti-shield-check' },
          { key: 'technicien', label: 'Techniciens', value: techniciens.length, icon: 'ti-tool' },
          { key: 'citoyen', label: 'Citoyens', value: citoyens.length, icon: 'ti-user' },
          { key: 'inactifs', label: 'Inactifs', value: inactifs.length, icon: 'ti-user-off' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFiltre(s.key === 'inactifs' ? 'tous' : (s.key as any))}
            className="bg-white rounded-md p-5 border text-left transition-colors"
            style={{ borderColor: filtre === s.key ? ORANGE : '#f1f3f5' }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-widest">{s.label}</span>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: NAVY }}>
                <i className={`ti ${s.icon} text-sm text-white`} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: NAVY }}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Filtres rapides */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'tous', label: 'Tous' },
          { key: 'superviseur', label: 'Superviseurs' },
          { key: 'technicien', label: 'Techniciens' },
          { key: 'citoyen', label: 'Citoyens' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key as any)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: filtre === f.key ? NAVY : '#fff',
              color: filtre === f.key ? '#fff' : '#6b7280',
              border: filtre === f.key ? 'none' : '1px solid #e5e7eb',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibles.length === 0 ? (
          <p className="text-gray-300 text-sm col-span-2 text-center py-10">Aucun membre pour ce filtre</p>
        ) : visibles.map(m => {
          const badge = ROLE_BADGE[m.role] || ROLE_BADGE.citoyen
          return (
            <div key={m.id} className="bg-white rounded-md border border-gray-100 p-4 flex items-center gap-3 hover:shadow-md hover:border-[#dc2626] transition-all duration-200">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: NAVY }}
              >
                {m.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{m.username}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 flex items-center gap-1" style={{ background: badge.bg, color: badge.color }}>
                    <i className={`ti ${m.role === 'technicien' ? 'ti-tool' : m.role === 'superviseur' ? 'ti-shield-check' : 'ti-user'} text-[10px]`} />
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
                {m.role === 'technicien' && m.permis_recq && (
                  <p className="text-xs text-gray-300">Permis R.E.C.Q. {m.permis_recq}</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => setEditingMembre(m)}
                  className="text-gray-400 hover:text-[#dc2626] transition-colors" title="Modifier ce membre">
                  <i className="ti ti-pencil text-base" />
                </button>
                <button
                  onClick={() => toggleActif(m.id)}
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: m.est_actif ? '#0d6b4f' : '#9ca3af' }}
                  title={m.est_actif ? 'Désactiver ce compte' : 'Réactiver ce compte'}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.est_actif ? '#2fbf6e' : '#c7cfd8' }} />
                  {m.est_actif ? 'Actif' : 'Inactif'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={charger} />}
      {editingMembre && <EditModal membre={editingMembre} onClose={() => setEditingMembre(null)} onSaved={charger} />}
    </div>
  )
}