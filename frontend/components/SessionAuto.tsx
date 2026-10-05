'use client'

// Renouvellement automatique de la session.
//
// Le jeton d'accès expire après 60 minutes (SIMPLE_JWT) ; le jeton de
// renouvellement (refresh_token, 1 jour) était stocké mais jamais utilisé —
// passé une heure, toutes les actions échouaient en 401 sans message.
// On enveloppe une seule fois window.fetch : sur un 401 de notre API, on
// renouvelle le jeton puis on rejoue la requête avec le nouveau ; si le
// renouvellement échoue, retour à la page de connexion.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

let renouvellementEnCours: Promise<string | null> | null = null

async function renouvelerJeton(fetchOriginal: typeof fetch): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return null
  try {
    const res = await fetchOriginal(`${API_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return null
    const data = await res.json()
    localStorage.setItem('access_token', data.access)
    if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
    return data.access as string
  } catch {
    return null
  }
}

function urlDe(entree: RequestInfo | URL): string {
  if (typeof entree === 'string') return entree
  if (entree instanceof URL) return entree.href
  return entree.url
}

if (typeof window !== 'undefined' && !(window as any).__sessionAutoInstallee) {
  (window as any).__sessionAutoInstallee = true
  const fetchOriginal = window.fetch.bind(window)

  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
    const reponse = await fetchOriginal(entree, init)
    const url = urlDe(entree)
    if (reponse.status !== 401 || !url.startsWith(API_URL) || url.includes('/api/token/')) {
      return reponse
    }

    // Plusieurs requêtes peuvent échouer en même temps : un seul renouvellement.
    renouvellementEnCours ??= renouvelerJeton(fetchOriginal).finally(() => { renouvellementEnCours = null })
    const nouveau = await renouvellementEnCours
    if (!nouveau) {
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('access_token')
        window.location.href = `/login?expire=1&retour=${encodeURIComponent(window.location.pathname)}`
      }
      return reponse
    }

    const entetes = new Headers(init?.headers || (entree instanceof Request ? entree.headers : undefined))
    entetes.set('Authorization', `Bearer ${nouveau}`)
    return fetchOriginal(entree, { ...init, headers: entetes })
  }
}

export default function SessionAuto() {
  return null
}
