'use client'

import { LEGENDE_NON_CONFORMITES, LIBELLE_NC, estEnDeficience } from '@/lib/nonConformites'
import { PastilleNC } from './TableExtincteurs'

const NAVY = '#0f172a'
const RED = '#dc2626'
// Même noir que les en-têtes de tableau, la légende et le PDF.
const NOIR = '#0a0b0d'

/** Toutes les déficiences du rapport au même endroit : client, adresse, puis
 *  chaque extincteur / boyau à problème avec son emplacement et son commentaire. */
export default function OngletDeficiences({ rapport }: { rapport: any }) {
  const bat = rapport.batiment || {}
  const extincteurs = (rapport.extincteurs || []).filter(estEnDeficience)
  const boyaux = (rapport.boyaux || []).filter(estEnDeficience)
  const total = extincteurs.length + boyaux.length

  // Nombre d'extincteurs par code de non-conformité.
  const parCode = LEGENDE_NON_CONFORMITES
    .map(l => ({ ...l, n: extincteurs.filter((it: any) => it.non_conformites?.includes(l.code)).length }))
    .filter(l => l.n > 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Client + adresse */}
      <div className="rounded-lg overflow-hidden shadow-sm border border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4" style={{ background: NOIR }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>
              {bat.client_nom || '—'}
            </p>
            <p className="text-lg font-bold text-white truncate">{bat.nom || bat.adresse_complete}</p>
            <p className="text-xs text-white/60 flex items-center gap-1">
              <i className="ti ti-map-pin" />
              {[bat.adresse_complete, bat.province, bat.code_postal].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-3xl font-extrabold leading-none" style={{ color: total ? '#f87171' : '#4ade80' }}>{total}</p>
              <p className="text-[11px] text-white/60 mt-1">déficience{total > 1 ? 's' : ''}</p>
            </div>
            <span className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: total ? 'rgba(220,38,38,0.2)' : 'rgba(74,222,128,0.15)' }}>
              <i className={`ti ${total ? 'ti-alert-triangle' : 'ti-circle-check'} text-xl`}
                style={{ color: total ? '#f87171' : '#4ade80' }} />
            </span>
          </div>
        </div>
        {parCode.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
            {parCode.map(l => (
              <span key={l.code} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-gray-50 border border-gray-100 pl-1 pr-2.5 py-0.5">
                <PastilleNC code={l.code} />
                <span style={{ color: NAVY }}>{l.fr}</span>
                <strong style={{ color: RED }}>× {l.n}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
          <i className="ti ti-circle-check text-5xl text-green-300" />
          <p className="mt-3 text-sm font-semibold text-gray-500">Aucune déficience — tout est conforme.</p>
        </div>
      ) : (
        <>
        {/* Téléphone : une carte par déficience, sans défilement horizontal. */}
        <div className="md:hidden flex flex-col gap-2">
          {[...extincteurs.map((it: any) => ({ it, boyau: false })), ...boyaux.map((it: any) => ({ it, boyau: true }))].map(({ it, boyau }) => (
            <div key={`${boyau ? 'b' : 'e'}-${it.id}`} className="bg-white rounded-lg border border-gray-200 shadow-sm p-3"
              style={{ borderLeft: `4px solid ${it.etat === 'D' ? '#ef4444' : NOIR}` }}>
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 text-white" style={{ background: NOIR }}>{it.ordre}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold break-words" style={{ color: NOIR }}>{it.emplacement || '—'}</p>
                  <p className="font-mono text-xs font-bold" style={{ color: NOIR }}>
                    {boyau ? "Boyau d'incendie" : it.code_equipement || '—'}
                  </p>
                </div>
                {it.etat === 'D' && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: RED, background: '#fee2e2' }}>Défectueux</span>
                )}
              </div>
              {(it.non_conformites || []).length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {it.non_conformites.map((c: string) => (
                    <span key={c} className="flex items-center gap-1.5 text-xs">
                      <PastilleNC code={c} /><span className="font-semibold" style={{ color: NOIR }}>{LIBELLE_NC[c]}</span>
                    </span>
                  ))}
                </div>
              )}
              {it.remarque && <p className="text-sm font-semibold mt-2 break-words" style={{ color: NOIR }}>{it.remarque}</p>}
            </div>
          ))}
        </div>

        <div className="hidden md:block bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-widest text-white" style={{ background: '#0a0b0d' }}>
                  <th className="text-center px-3 py-2.5 w-12">No</th>
                  <th className="text-left px-3 py-2.5">Emplacement</th>
                  <th className="text-left px-3 py-2.5">Équipement</th>
                  <th className="text-left px-3 py-2.5">Non-conformités</th>
                </tr>
              </thead>
              <tbody>
                {extincteurs.map((it: any, i: number) => (
                  <tr key={`e-${it.id}`} className={`border-t border-gray-50 align-top ${i % 2 ? 'bg-gray-50/50' : ''}`}
                    style={it.etat === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                    <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: NOIR }}>{it.ordre}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{it.emplacement || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs font-bold whitespace-nowrap" style={{ color: NOIR }}>{it.code_equipement || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        {(it.non_conformites || []).map((c: string) => (
                          <span key={c} className="flex items-center gap-1.5 text-xs">
                            <PastilleNC code={c} /><span className="font-semibold" style={{ color: NOIR }}>{LIBELLE_NC[c]}</span>
                          </span>
                        ))}
                        {it.remarque && <span className="text-sm font-semibold" style={{ color: NOIR }}>{it.remarque}</span>}
                        {it.etat === 'D' && !(it.non_conformites || []).length && !it.remarque && (
                          <span className="text-xs font-semibold text-red-600">Défectueux</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {boyaux.length > 0 && (
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td colSpan={4} className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: NAVY }}>
                      <i className="ti ti-ripple mr-1" /> Boyaux d'incendie
                    </td>
                  </tr>
                )}
                {boyaux.map((b: any) => (
                  <tr key={`b-${b.id}`} className="border-t border-gray-50 align-top"
                    style={b.etat === 'D' ? { borderLeft: '3px solid #ef4444' } : undefined}>
                    <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: NOIR }}>{b.ordre}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-bold" style={{ color: NAVY }}>{b.emplacement || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: NOIR }}>Boyau</td>
                    <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: NOIR }}>
                      {b.remarque || (b.etat === 'D' ? <span className="text-xs text-red-600">Défectueux</span> : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
