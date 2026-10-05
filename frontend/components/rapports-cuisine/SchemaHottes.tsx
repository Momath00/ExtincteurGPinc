'use client'

import { useEffect, useRef, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NAVY = '#0f172a'
const ORANGE = '#dc2626'

// ── Icônes d'appareils (monoline, style Tabler) ─────────────────────────────
function AppareilIcon({ code, color = '#dc2626', size = 15, buse }: { code: string; color?: string; size?: number; buse?: SensBuseSalamandre }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (code) {
    case 'F': // Friteuse — rectangle, panier intérieur, tige relevée
      return <svg {...common}><rect x="5" y="4" width="14" height="16" /><rect x="9" y="6.5" width="6" height="7" /><path d="M12 20v-6.5" /><path d="M9.7 15.7L12 13.5l2.3 2.2" /></svg>
    case 'B': // Friteuse sous pression — panier + jauge
      return <svg {...common}><path d="M5 10h11l-1.2 8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 10Z" /><path d="M9 13h5" /><circle cx="18.5" cy="7.5" r="2.5" /><path d="M18.5 6v1.5l1 1" /></svg>
    case 'P': // Plaque chauffante — surface unie, rectangle net et allongé
      return <svg {...common}><rect x="2" y="8" width="20" height="8" /></svg>
    case 'R2': // Cuisinière 2 feux — rectangle vertical, 1 colonne
      return <svg {...common}><rect x="7" y="3" width="10" height="18" rx="1.5" /><circle cx="12" cy="8" r="2" /><circle cx="12" cy="16" r="2" /></svg>
    case 'R4': // Cuisinière 4 feux — carré, 2×2
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><circle cx="9" cy="9" r="1.8" /><circle cx="15" cy="9" r="1.8" /><circle cx="9" cy="15" r="1.8" /><circle cx="15" cy="15" r="1.8" /></svg>
    case 'R6': // Cuisinière 6 feux — rectangle large, 2×3
      return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="1.5" /><circle cx="7" cy="10" r="1.4" /><circle cx="12" cy="10" r="1.4" /><circle cx="17" cy="10" r="1.4" /><circle cx="7" cy="14" r="1.4" /><circle cx="12" cy="14" r="1.4" /><circle cx="17" cy="14" r="1.4" /></svg>
    case 'GC': // Grille charbon — rectangle net, hachures quasi verticales
      return <svg {...common}><rect x="4" y="5" width="16" height="14" /><path d="M6 19l1.5-14M9.5 19l1.5-14M13 19l1.5-14M16.5 19l1.5-14" /></svg>
    case 'GZ': // Grille à gaz — rectangle net, barreaux horizontaux
      return <svg {...common}><rect x="4" y="5" width="16" height="14" /><path d="M6 9h12M6 12h12M6 15h12" /></svg>
    case 'S': // Salamandre — élément chauffant suspendu (peigne), rectangle net
      if (buse) {
        // Avec sa buse coudée à 90° : « |_> » ou « <_| ».
        const d = buse === 'droite' ? 'M8 11v5h7M13 14l2 2-2 2' : 'M16 11v5H9M11 14l-2 2 2 2'
        return <svg {...common}><rect x="4" y="8" width="16" height="12" /><path d="M6.5 8v-3M17.5 8v-3" /><path d={d} /></svg>
      }
      return <svg {...common}><rect x="4" y="9" width="16" height="9" /><path d="M6.5 9v-3M10 9v-3M13.5 9v-3M17 9v-3" /></svg>
    case 'SP': // Stock pot — brûleur haute puissance en éclat
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><circle cx="12" cy="12" r="1.4" fill={color} /><path d="M12 6.5v2.2M12 15.3v2.2M5.5 12h2.2M16.3 12h2.2M8 8l1.5 1.5M14.5 14.5L16 16M8 16l1.5-1.5M14.5 9.5L16 8" /></svg>
    case 'BP': // Bassin à frire
      return <svg {...common}><path d="M4 10c1.5 1 3 1.5 8 1.5s6.5-.5 8-1.5" /><path d="M4 10v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3" /></svg>
    case 'W': // Wok
      return <svg {...common}><path d="M3 12a9 9 0 0 0 18 0" /><path d="M3 12h18M5 9l-2-1.5M19 9l2-1.5" /></svg>
    case 'SH': // Shawarma — broche verticale, cône de viande à l'envers, plateau
      return <svg {...common}><path d="M12 1.5V21" /><path d="M7 4h10l-3.5 12.5h-3Z" /><path d="M8 7.5h8M9 11h6" /><path d="M6.5 21h11" /></svg>
    default: // Autre
      return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="2.5" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
  }
}

const CUISINIERE_DIMS: Record<string, { w: number; h: number; cols: number; rows: number }> = {
  R2: { w: 16, h: 30, cols: 1, rows: 2 },
  R4: { w: 26, h: 26, cols: 2, rows: 2 },
  R6: { w: 40, h: 26, cols: 3, rows: 2 },
}

// ── Unité d'appareil avec quantité — rendu réaliste (batterie de friteuses,
// cuisinière à N feux fixes, plaque/grille sur N sections) plutôt qu'un
// simple badge. ──
let clipSeq = 0
function AppareilUnit({ code, qty, x, y, taille }: { code: string; qty: number; x: number; y: number; taille?: number }) {
  const n = Math.max(1, qty)
  const step = 15
  const w = 22 + (n - 1) * step
  const h = 26
  const stroke = '#334155'
  const clipId = useRef(`grillClip${clipSeq++}`).current

  if (CUISINIERE_DIMS[code]) {
    const dims = CUISINIERE_DIMS[code]
    const gap = 6
    const totalW = dims.w * n + gap * (n - 1)
    return (
      <g>
        {Array.from({ length: n }).map((_, i) => {
          const bx = x - totalW / 2 + dims.w / 2 + i * (dims.w + gap)
          const cellW = dims.w / (dims.cols + 1)
          const cellH = dims.h / (dims.rows + 1)
          return (
            <g key={i}>
              <rect x={bx - dims.w / 2} y={y - dims.h / 2} width={dims.w} height={dims.h} rx={3} fill="#fff" stroke={stroke} strokeWidth={1.4} />
              {Array.from({ length: dims.rows }).flatMap((_, r) =>
                Array.from({ length: dims.cols }).map((_, c) => (
                  <circle
                    key={`${r}-${c}`}
                    cx={bx - dims.w / 2 + cellW * (c + 1)}
                    cy={y - dims.h / 2 + cellH * (r + 1)}
                    r={Math.min(cellW, cellH) * 0.32}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.1}
                  />
                ))
              )}
            </g>
          )
        })}
      </g>
    )
  }
  if (code === 'P') {
    // Plaque — largeur réelle en pouces (12/24/36/48/60), pas liée à la
    // quantité. Une division tous les 12 po (segments de la plaque).
    const inch = taille || 24
    const wPlaque = inch * 2
    const segments = Math.max(1, Math.round(inch / 12))
    return (
      <g>
        <rect x={x - wPlaque / 2} y={y - h / 2} width={wPlaque} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: segments - 1 }).map((_, i) => (
          <line key={i} x1={x - wPlaque / 2 + (i + 1) * (wPlaque / segments)} y1={y - h / 2 + 4} x2={x - wPlaque / 2 + (i + 1) * (wPlaque / segments)} y2={y + h / 2 - 4} stroke={stroke} strokeWidth={1} />
        ))}
        <text x={x} y={y + 3} textAnchor="middle" fill={stroke} fontSize={9} fontWeight={700} style={{ pointerEvents: 'none' }}>
          {inch}″
        </text>
      </g>
    )
  }
  if (code === 'GC') {
    // Rectangle net (coins non arrondis) rempli de traits quasi verticaux
    // (léger biais), serrés, comme une grille de charbon vue de face.
    const slant = 6
    const spacing = 6
    const diagLines = []
    for (let dx = -slant; dx <= w + slant; dx += spacing) {
      const lx1 = x - w / 2 + dx
      const ly1 = y + h / 2
      const lx2 = lx1 + slant
      const ly2 = y - h / 2
      diagLines.push(<line key={dx} x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={stroke} strokeWidth={1} />)
    }
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={x - w / 2} y={y - h / 2} width={w} height={h} />
          </clipPath>
        </defs>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        <g clipPath={`url(#${clipId})`}>{diagLines}</g>
      </g>
    )
  }
  if (code === 'GZ') {
    // Grille à gaz — même rectangle net que la grille charbon, mais barreaux
    // horizontaux (grilles de cuisson) pour la distinguer au premier coup d'œil.
    const barreaux = []
    for (let dy = 4; dy < h - 2; dy += 5) {
      barreaux.push(<line key={dy} x1={x - w / 2 + 3} y1={y - h / 2 + dy} x2={x + w / 2 - 3} y2={y - h / 2 + dy} stroke={stroke} strokeWidth={1} />)
    }
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {barreaux}
      </g>
    )
  }
  if (code === 'S') {
    const tickCount = Math.max(3, Math.round(w / 8))
    const ticks = Array.from({ length: tickCount }).map((_, i) => {
      const tx = x - w / 2 + 4 + (i * (w - 8)) / (tickCount - 1)
      return <line key={i} x1={tx} y1={y - h / 2} x2={tx} y2={y - h / 2 + 6} stroke={stroke} strokeWidth={1} />
    })
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {ticks}
      </g>
    )
  }
  if (code === 'F') {
    // Rectangle net avec panier intérieur et tige relevée (poignée) —
    // comme la friteuse dessinée à la main.
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: n }).map((_, i) => {
          const cx = x - w / 2 + 11 + i * step
          const innerW = 10, innerH = 12
          return (
            <g key={i}>
              <rect x={cx - innerW / 2} y={y - innerH / 2 - 1} width={innerW} height={innerH} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx} ${y + h / 2 - 2} V ${y - innerH / 2 + 3}`} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx - 2} ${y - innerH / 2 + 5.5} L ${cx} ${y - innerH / 2 + 2.5} L ${cx + 2} ${y - innerH / 2 + 5.5}`} fill="none" stroke={stroke} strokeWidth={1.1} />
            </g>
          )
        })}
      </g>
    )
  }
  if (code === 'B') {
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={5} fill="#fff" stroke={stroke} strokeWidth={1.4} />
        {Array.from({ length: n }).map((_, i) => {
          const cx = x - w / 2 + 11 + i * step
          return (
            <g key={i}>
              <path d={`M ${cx - 5} ${y - 6} h 10 l -1.4 9 a 1.6 1.6 0 0 1 -1.6 1.4 h -3.6 a 1.6 1.6 0 0 1 -1.6 -1.4 Z`} fill="none" stroke={stroke} strokeWidth={1.1} />
              <path d={`M ${cx - 3.2} ${y - 6} v -1.6 h 6.4 v 1.6`} fill="none" stroke={stroke} strokeWidth={1.1} />
            </g>
          )
        })}
      </g>
    )
  }
  // Même boîte arrondie que friteuse/cuisinière/grille — la quantité est une
  // pastille ×N plutôt qu'une icône répétée, pour rester lisible.
  const wBadge = 34
  return (
    <g>
      <rect x={x - wBadge / 2} y={y - h / 2} width={wBadge} height={h} rx={6} fill="#fff" stroke={stroke} strokeWidth={1.4} />
      <g transform={`translate(${x - 8.5}, ${y - 8.5})`}>
        <AppareilIcon code={code} color={stroke} size={17} />
      </g>
      {n > 1 && (
        <g>
          <circle cx={x + wBadge / 2 - 3} cy={y + h / 2 - 3} r={7} fill="#dc2626" />
          <text x={x + wBadge / 2 - 3} y={y + h / 2 - 2.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={800}>×{n}</text>
        </g>
      )}
    </g>
  )
}

const CODES: { code: string; label: string }[] = [
  { code: 'F', label: 'Friteuse' },
  { code: 'B', label: 'Friteuse sous pression' },
  { code: 'P', label: 'Plaque chauffante' },
  { code: 'R2', label: 'Cuisinière 2 feux' },
  { code: 'R4', label: 'Cuisinière 4 feux' },
  { code: 'R6', label: 'Cuisinière 6 feux' },
  { code: 'GC', label: 'Grille charbon' },
  { code: 'GZ', label: 'Grille à gaz' },
  { code: 'S', label: 'Salamandre' },
  { code: 'SP', label: 'Stock pot' },
  { code: 'BP', label: 'Bassin à frire' },
  { code: 'W', label: 'Wok' },
  { code: 'SH', label: 'Shawarma' },
  { code: 'O', label: 'Autre' },
]
const CODE_LABEL = Object.fromEntries(CODES.map(c => [c.code, c.label]))

// Largeur visuelle approximative d'un appareil (même logique que
// AppareilUnit) — sert uniquement à dimensionner sa zone de clic tactile,
// pas à le dessiner.
function largeurAppareil(code: string, qty: number, taille?: number): number {
  const n = Math.max(1, qty || 1)
  const step = 15
  if (CUISINIERE_DIMS[code]) {
    const dims = CUISINIERE_DIMS[code]
    return dims.w * n + 6 * (n - 1)
  }
  if (code === 'P') return (taille || 24) * 2
  if (code === 'F' || code === 'B' || code === 'GC' || code === 'GZ' || code === 'S') return 22 + (n - 1) * step
  return 34
}
const QTY_LABEL: Record<string, string> = {
  F: 'Nombre de bassins', B: 'Nombre de bassins',
  R2: 'Nombre d\'appareils', R4: 'Nombre d\'appareils', R6: 'Nombre d\'appareils',
}

const BOX = { x0: 34, x1: 456, topY: 92, botY: 167 }
const DIVIDER_SNAP = 18
// Zone des buses (sous la hotte) et des appareils (encore plus bas) — décalées
// vers le bas d'autant que l'épaississement de la hotte (BOX.botY: 132→167).
// Appareils encore un peu plus bas pour laisser un espace net avec les buses.
const BUSES_Y_MAX = 213
const APPAREILS_Y_MAX = 270
const VIEWBOX_H = 270

type Direction = 'gauche' | 'droite' | 'horizontale' | 'haut' | 'fusible'
// conforme absent/true = verte (par défaut) ; conforme=false = rouge — mal
// placée, ne protège pas l'appareil visé, ou marque l'absence d'une buse
// attendue. Décidé manuellement par le technicien, pas de calcul automatique.
type Buse = { x: number; direction?: Direction; interieur?: boolean; exterieur?: boolean; conforme?: boolean }
const BUSE_VERT = '#16a34a'
const BUSE_ROUGE = '#dc2626'
const FUSIBLE_BLEU = '#2563eb'

// Tracé d'une buse — droite (vide) = verticale ; gauche/droite = oblique ;
// horizontale = à plat. Partagé par l'éditeur et pensé pour être répliqué
// tel quel côté PDF (securiteincendie/inspections/views.py, _rendu_hotte_html).
function traceBuse(x: number, y1: number, direction?: Direction): { shaft: string; tip: string } {
  if (direction === 'gauche') return { shaft: `M ${x} ${y1} L ${x - 7} ${y1 + 10}`, tip: `${x - 5},${y1 + 11} ${x - 10},${y1 + 8} ${x - 10},${y1 + 13}` }
  if (direction === 'droite') return { shaft: `M ${x} ${y1} L ${x + 7} ${y1 + 10}`, tip: `${x + 5},${y1 + 11} ${x + 10},${y1 + 8} ${x + 10},${y1 + 13}` }
  if (direction === 'horizontale') return { shaft: `M ${x} ${y1} L ${x + 12} ${y1}`, tip: `${x + 12},${y1 - 2} ${x + 12},${y1 + 2} ${x + 16},${y1}` }
  if (direction === 'haut') return { shaft: `M ${x} ${y1} L ${x} ${y1 - 12}`, tip: `${x - 2},${y1 - 12} ${x + 2},${y1 - 12} ${x},${y1 - 16}` }
  if (direction === 'fusible') {
    // Lien-fusible — représenté « |--| » : deux repères verticaux reliés par
    // un trait horizontal, sans flèche.
    return { shaft: `M ${x - 8} ${y1 - 4} L ${x - 8} ${y1 + 4} M ${x - 8} ${y1} L ${x + 8} ${y1} M ${x + 8} ${y1 - 4} L ${x + 8} ${y1 + 4}`, tip: '' }
  }
  return { shaft: `M ${x} ${y1} L ${x} ${y1 + 12}`, tip: `${x - 2},${y1 + 12} ${x + 2},${y1 + 12} ${x},${y1 + 16}` }
}
// Salamandre : buse coudée à 90° à l'intérieur, « |_> » (droite) ou
// « <_| » (gauche). buse_conforme=false = rouge, comme les autres buses.
type SensBuseSalamandre = 'gauche' | 'droite'
type Appareil = { code: string; x: number; side: 'above' | 'below'; qty?: number; taille?: number; nom?: string; buse?: SensBuseSalamandre; buse_conforme?: boolean }

// Tracé de la buse coudée d'une salamandre centrée en (x, y) — même tracé
// que _buse_salamandre_svg côté PDF.
function traceBuseSalamandre(x: number, y: number, sens: SensBuseSalamandre): { shaft: string; tip: string } {
  const s = sens === 'droite' ? 1 : -1
  return {
    shaft: `M ${x - 6 * s} ${y - 5} L ${x - 6 * s} ${y + 5} L ${x + 4 * s} ${y + 5}`,
    tip: `${x + 4 * s},${y + 2} ${x + 4 * s},${y + 8} ${x + 8 * s},${y + 5}`,
  }
}

// Texte sous l'appareil : la désignation saisie pour un « Autre » (O),
// sinon le code — même règle que _libelle_appareil côté PDF.
function libelleAppareil(a: Appareil): string {
  return a.code === 'O' && a.nom?.trim() ? a.nom.trim() : a.code
}

// Hauteurs de rendu — partagées par le dessin et le glisser (centre du
// zoom pendant le geste).
function yBuse(b: Buse): number {
  return b.exterieur ? 61 : b.interieur ? (BOX.topY + BOX.botY) / 2 : BOX.botY + 6
}
function yElevation(el: { interieur?: boolean }): number {
  return el.interieur ? (BOX.topY + BOX.botY) / 2 - 17 : 44
}
// La salamandre (S) est montée en hauteur, au-dessus de la ligne de cuisson.
function yAppareil(a: Appareil): number {
  return a.code === 'S' ? 205 : 245
}
const TAILLES_PLAQUE = [12, 24, 36, 48, 60]
// Petits carrés « taille de hotte » (en pieds), posés en haut à l'intérieur
// de la hotte — même hauteur que _rendu_hotte_html côté PDF.
const TAILLES_HOTTE = Array.from({ length: 16 }, (_, i) => i + 3)
const Y_TAILLE = BOX.topY + 12

// ── Outil sélectionné dans la barre permanente. Les outils de pose (buse,
// élévation, appareil) se désélectionnent d'eux-mêmes après une pose — un
// tap de trop sur tablette ne pose plus un doublon. Les outils de la
// palette rouge (conformité, retrait) restent actifs pour enchaîner
// plusieurs buses, sans popup à viser au doigt. ──
type Outil =
  | { kind: 'buse'; direction?: Direction }
  | { kind: 'elevation' }
  | { kind: 'appareil'; code: string; taille?: number; buse?: SensBuseSalamandre }
  | { kind: 'conformite'; conforme: boolean }
  | { kind: 'gomme' }
  | { kind: 'deplacer' }
  | { kind: 'separateur' }
  | { kind: 'taille'; pieds: number }

function outilsEgaux(a: Outil | null, b: Outil | null): boolean {
  if (!a || !b) return a === b
  if (a.kind !== b.kind) return false
  if (a.kind === 'buse' && b.kind === 'buse') return a.direction === b.direction
  if (a.kind === 'appareil' && b.kind === 'appareil') return a.code === b.code && a.taille === b.taille && a.buse === b.buse
  if (a.kind === 'conformite' && b.kind === 'conformite') return a.conforme === b.conforme
  if (a.kind === 'taille' && b.kind === 'taille') return a.pieds === b.pieds
  return true
}

function estOutilStatut(o: Outil | null): boolean {
  return o?.kind === 'conformite' || o?.kind === 'gomme'
}

// Outils qui restent actifs jusqu'à « Terminé » (palette du haut).
function estOutilPersistant(o: Outil | null): boolean {
  return estOutilStatut(o) || o?.kind === 'deplacer'
}

const BLEU_DEPLACER = '#2563eb'

const OUTILS_STATUT: { outil: Outil; label: string; icon: string; couleur: string; fond: string }[] = [
  { outil: { kind: 'conformite', conforme: false }, label: 'Non conforme', icon: 'ti-x', couleur: BUSE_ROUGE, fond: '#fee2e2' },
  { outil: { kind: 'conformite', conforme: true }, label: 'Conforme', icon: 'ti-check', couleur: BUSE_VERT, fond: '#dcfce7' },
  { outil: { kind: 'gomme' }, label: 'Retirer', icon: 'ti-eraser', couleur: '#475569', fond: '#f1f5f9' },
  { outil: { kind: 'deplacer' }, label: 'Déplacer', icon: 'ti-arrows-move', couleur: BLEU_DEPLACER, fond: '#dbeafe' },
]

const OUTILS_BUSE: { outil: Outil; label: string; icon: React.ReactNode }[] = [
  { outil: { kind: 'buse' }, label: 'Buse droite', icon: <i className="ti ti-arrow-down text-base" /> },
  { outil: { kind: 'buse', direction: 'gauche' }, label: 'Buse oblique gauche', icon: <i className="ti ti-arrow-down-left text-base" /> },
  { outil: { kind: 'buse', direction: 'droite' }, label: 'Buse oblique droite', icon: <i className="ti ti-arrow-down-right text-base" /> },
  { outil: { kind: 'buse', direction: 'horizontale' }, label: 'Buse horizontale', icon: <i className="ti ti-arrow-right text-base" /> },
  { outil: { kind: 'buse', direction: 'haut' }, label: 'Buse vers le haut', icon: <i className="ti ti-arrow-up text-base" /> },
  {
    outil: { kind: 'buse', direction: 'fusible' }, label: 'Lien-fusible',
    icon: <svg width="16" height="16" viewBox="0 0 18 18"><path d="M4 5v8M4 9h10M14 5v8" fill="none" stroke="currentColor" strokeWidth={1.8} /></svg>,
  },
  { outil: { kind: 'elevation' }, label: 'Élévation', icon: <i className="ti ti-square text-base" /> },
  {
    outil: { kind: 'separateur' }, label: 'Séparateur de hotte',
    icon: <svg width="16" height="16" viewBox="0 0 18 18"><path d="M9 1v16" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /></svg>,
  },
]

const OUTILS_APPAREIL: { outil: Outil; label: string }[] = [
  ...CODES.filter(c => c.code !== 'P').flatMap(c => c.code === 'S'
    ? [
      { outil: { kind: 'appareil' as const, code: 'S', buse: 'gauche' as const }, label: 'Salamandre <_|' },
      { outil: { kind: 'appareil' as const, code: 'S', buse: 'droite' as const }, label: 'Salamandre |_>' },
    ]
    : [{ outil: { kind: 'appareil' as const, code: c.code }, label: c.label }]),
  ...TAILLES_PLAQUE.map(t => ({ outil: { kind: 'appareil' as const, code: 'P', taille: t }, label: `Plaque ${t}″` })),
]

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

let gradientSeq = 0

type Cible = 'buse' | 'elevation' | 'appareil' | 'separateur' | 'taille'
// Élément sélectionné en mode « Déplacer » (une seule sélection pour tout
// le schéma, toutes hottes confondues).
type Selection = { hotteId: number; cible: Cible; index: number }
type Glisse = { cible: Cible; index: number; x0: number }
// Distance (pixels écran) sous laquelle un geste reste un tap.
const SEUIL_TAP_PX = 6

function HotteEditor({
  hotte,
  readOnly,
  onPatch,
  onDelete,
  outil,
  onOutilUtilise,
  selection,
  onSelectionner,
  onDeplacer,
}: {
  hotte: any
  readOnly: boolean
  onPatch: (id: number, patch: any) => void
  onDelete: (id: number) => void
  outil: Outil | null
  onOutilUtilise: () => void
  selection: { cible: Cible; index: number } | null
  onSelectionner: (s: { cible: Cible; index: number }) => void
  onDeplacer: (cible: Cible, index: number, x: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useRef(`hotteGrad${gradientSeq++}`)
  const [label, setLabel] = useState(hotte.label || '')
  const [edition, setEdition] = useState<{ index: number } | null>(null)
  const [glisse, setGlisse] = useState<Glisse | null>(null)
  const repereRef = useRef<SVGGElement | null>(null)
  const decalageRef = useRef(0)
  const [buseEdition, setBuseEdition] = useState<{ index: number } | null>(null)
  const modeStatut = !readOnly && estOutilStatut(outil)
  const modeDeplacer = !readOnly && outil?.kind === 'deplacer'
  const ignorerClicJusquaRef = useRef(0)
  const estSelectionne = (cible: Cible, index: number) => modeDeplacer && selection?.cible === cible && selection.index === index

  const appareils: Appareil[] = hotte.appareils || []
  const dividers: number[] = hotte.dividers || []
  const tailles: { x: number; pieds: number }[] = hotte.tailles || []
  // Placement manuel des buses uniquement — aucune génération automatique à
  // partir de l'ancien compteur, le technicien les place lui-même. Chaque
  // buse peut être droite (par défaut) ou oblique (gauche/droite).
  const buses: Buse[] = hotte.buses || []
  const nbFusibles = buses.filter(b => b.direction === 'fusible').length
  // Buses coudées intégrées aux salamandres — comptées avec les autres.
  const nbBusesSalamandre = appareils.filter(a => a.code === 'S' && a.buse).length
  const nbBuses = buses.length - nbFusibles + nbBusesSalamandre
  // Élévations (conduits verticaux vers le toit) — placées et déplacées
  // librement par le technicien, comme les buses. Peuvent être extérieures
  // (au-dessus de la hotte, par défaut) ou intérieures (au niveau du texte).
  const elevations: { x: number; interieur?: boolean }[] = hotte.elevations || []

  // Glisser au doigt — commun aux buses, élévations et appareils.
  // Pendant le geste, seul l'élément touché bouge : on lui applique
  // directement un décalage (attribut transform) à chaque image, SANS
  // redessiner le schéma via React — l'élément colle au doigt même sur une
  // tablette d'entrée de gamme. React ne redessine qu'une fois au départ
  // (repère vertical) et une fois au relâchement (nouvelle position,
  // sauvegardée en arrière-plan, voir patchHotte).
  // L'élément garde le point où il a été attrapé (pas de recentrage sous
  // le doigt) et suit dès le premier pixel ; un geste de moins de
  // SEUIL_TAP_PX à l'écran reste un tap. onFin reçoit la nouvelle
  // position, ou null pour un tap.
  function demarrerGlisser(e: React.PointerEvent, el: SVGGraphicsElement, cible: Glisse['cible'], index: number, xDepart: number, yCentre: number, onFin: (x: number | null) => void) {
    if (readOnly || !svgRef.current) return
    e.stopPropagation()
    const svg = svgRef.current
    const pointerId = e.pointerId
    try { el.setPointerCapture(pointerId) } catch { /* navigateur sans capture */ }
    const startP = toSvgPoint(svg, e.clientX, e.clientY)
    const startClientX = e.clientX
    const startClientY = e.clientY
    let x = xDepart
    let moved = false
    let raf = 0
    decalageRef.current = 0

    function appliquer() {
      raf = 0
      const dx = x - xDepart
      decalageRef.current = dx
      // Légèrement agrandi une fois « pris », pour dépasser du doigt.
      const zoom = moved ? ` translate(${xDepart} ${yCentre}) scale(1.18) translate(${-xDepart} ${-yCentre})` : ''
      el.setAttribute('transform', `translate(${dx} 0)${zoom}`)
      repereRef.current?.setAttribute('transform', `translate(${dx} 0)`)
    }
    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      const p = toSvgPoint(svg, ev.clientX, ev.clientY)
      x = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(xDepart + (p.x - startP.x))))
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) > SEUIL_TAP_PX) {
        moved = true
        setGlisse({ cible, index, x0: xDepart })
        try { navigator.vibrate?.(8) } catch { /* pas de vibreur (iPad) */ }
      }
      if (!raf) raf = requestAnimationFrame(appliquer)
    }
    function terminer(ev: PointerEvent, annule: boolean) {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (raf) cancelAnimationFrame(raf)
      // Retire le décalage manuel ; la nouvelle position arrive par React
      // dans le même rendu (onFin → onPatch), donc aucun retour en arrière
      // visible.
      el.removeAttribute('transform')
      setGlisse(null)
      // Le clic qui suit un glisser (souris) ne doit pas re-sélectionner.
      if (moved) ignorerClicJusquaRef.current = Date.now() + 400
      if (!annule) onFin(moved ? x : null)
    }
    function onUp(ev: PointerEvent) { terminer(ev, false) }
    function onCancel(ev: PointerEvent) { terminer(ev, true) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function placerBuse(e: React.MouseEvent<SVGRectElement>, interieur = false, exterieur = false) {
    if (readOnly || !svgRef.current || outil?.kind !== 'buse') return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(p.x)))
    const next = [...buses, { x, direction: outil.direction, interieur: interieur || undefined, exterieur: exterieur || undefined }].sort((a, b) => a.x - b.x)
    onPatch(hotte.id, { buses: next })
    onOutilUtilise()
  }

  function retirerBuse(index: number) {
    if (readOnly) return
    const next = buses.filter((_, i) => i !== index)
    onPatch(hotte.id, { buses: next })
    setBuseEdition(null)
  }

  function definirConformiteBuse(index: number, conforme: boolean) {
    if (readOnly) return
    const next = buses.map((b, i) => (i === index ? { ...b, conforme: conforme ? undefined : false } : b))
    onPatch(hotte.id, { buses: next })
  }

  function placerElevation(e: React.MouseEvent<SVGRectElement>) {
    if (readOnly || !svgRef.current || outil?.kind !== 'elevation') return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(p.x)))
    const next = [...elevations, { x }].sort((a, b) => a.x - b.x)
    onPatch(hotte.id, { elevations: next })
    onOutilUtilise()
  }

  function placerTaille(e: React.MouseEvent<SVGRectElement>) {
    if (readOnly || !svgRef.current || outil?.kind !== 'taille') return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.min(BOX.x1 - 12, Math.max(BOX.x0 + 12, Math.round(p.x)))
    const next = [...tailles, { x, pieds: outil.pieds }].sort((a, b) => a.x - b.x)
    onPatch(hotte.id, { tailles: next })
    onOutilUtilise()
  }

  function retirerTaille(index: number) {
    if (readOnly) return
    onPatch(hotte.id, { tailles: tailles.filter((_, i) => i !== index) })
  }

  function retirerSeparateur(index: number) {
    if (readOnly) return
    onPatch(hotte.id, { dividers: dividers.filter((_, i) => i !== index) })
  }

  function retirerElevation(index: number) {
    if (readOnly) return
    const next = elevations.filter((_, i) => i !== index)
    onPatch(hotte.id, { elevations: next })
  }

  function placerAppareil(e: React.MouseEvent<SVGRectElement>, side: 'above' | 'below') {
    if (readOnly || !svgRef.current || outil?.kind !== 'appareil') return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.round(p.x)
    const next = [...appareils, { code: outil.code, x, side, taille: outil.taille, buse: outil.buse }]
    onPatch(hotte.id, { appareils: next })
    // « Autre » : ouvrir tout de suite la fiche pour saisir sa désignation.
    if (outil.code === 'O') setEdition({ index: next.length - 1 })
    onOutilUtilise()
  }

  function retirerAppareil(index: number) {
    if (readOnly) return
    const next = appareils.filter((_, i) => i !== index)
    onPatch(hotte.id, { appareils: next })
    setEdition(null)
  }

  function changerBuseSalamandre(index: number, patch: { buse?: SensBuseSalamandre | null; conforme?: boolean }) {
    if (readOnly) return
    const next = appareils.map((a, i) => {
      if (i !== index) return a
      const maj = { ...a }
      if (patch.buse !== undefined) maj.buse = patch.buse || undefined
      if (patch.conforme !== undefined) maj.buse_conforme = patch.conforme ? undefined : false
      return maj
    })
    onPatch(hotte.id, { appareils: next })
  }

  function changerNom(index: number, nom: string) {
    if (readOnly) return
    const next = appareils.map((a, i) => (i === index ? { ...a, nom: nom || undefined } : a))
    onPatch(hotte.id, { appareils: next })
  }

  function changerQuantite(index: number, qty: number) {
    if (readOnly) return
    const next = appareils.map((a, i) => (i === index ? { ...a, qty: Math.max(1, qty) } : a))
    onPatch(hotte.id, { appareils: next })
  }

  function clicSurConduit(e: React.MouseEvent<SVGRectElement>) {
    // Diviser la hotte avec l'outil « Séparateur » (ou sans outil actif) —
    // jamais avec un autre outil, sinon un tap raté sur une buse (palette
    // rouge) ou une pose ratée divise la hotte par erreur. Taper près d'un
    // séparateur existant le retire.
    if (outil?.kind === 'taille') { placerTaille(e); return }
    if (readOnly || !svgRef.current || (outil && outil.kind !== 'separateur')) return
    const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const x = Math.round(p.x)
    const proche = dividers.find(d => Math.abs(d - x) < DIVIDER_SNAP)
    const next = proche !== undefined
      ? dividers.filter(d => d !== proche)
      : [...dividers, x].sort((a, b) => a - b)
    onPatch(hotte.id, { dividers: next })
    if (outil?.kind === 'separateur') onOutilUtilise()
  }

  function reinitialiser() {
    if (readOnly) return
    onPatch(hotte.id, { appareils: [], dividers: [] })
  }

  function sauvegarderEntete() {
    if (readOnly) return
    onPatch(hotte.id, { label })
  }

  // Éléments sous le doigt (zones de toucher qui peuvent se chevaucher :
  // buse collée à un appareil, buses voisines), du plus proche au plus
  // éloigné — distance entre le doigt et le CENTRE de chaque élément.
  function elementsSousDoigt(clientX: number, clientY: number): { n: SVGGraphicsElement; cible: Cible; index: number }[] {
    const svg = svgRef.current
    if (!svg) return []
    const noeuds = Array.from(new Set(
      document.elementsFromPoint(clientX, clientY)
        .map(n => n.closest<SVGGraphicsElement>('[data-element]'))
        .filter((n): n is SVGGraphicsElement => !!n && svg.contains(n)),
    ))
    const r = svg.getBoundingClientRect()
    const sx = r.width / 512
    const sy = r.height / VIEWBOX_H
    const distance = (n: SVGGraphicsElement) =>
      Math.hypot(r.left + Number(n.dataset.cx) * sx - clientX, r.top + Number(n.dataset.cy) * sy - clientY)
    return noeuds
      .sort((a, b) => distance(a) - distance(b))
      .map(n => {
        const [cible, idx] = (n.dataset.element || '').split(':')
        return { n, cible: cible as Cible, index: Number(idx) }
      })
  }

  // Tap sur le schéma — un seul point d'entrée pour tous les éléments,
  // selon l'outil actif. Les zones de pose (buses/appareils/élévations) et
  // la division de la hotte gardent leurs propres gestionnaires.
  function surClicSchema(e: React.MouseEvent<SVGSVGElement>) {
    if (readOnly || !svgRef.current || Date.now() < ignorerClicJusquaRef.current) return
    // Séparateur : seul le tap sur la hotte compte (clicSurConduit).
    if (outil?.kind === 'separateur') return
    const [trouve] = elementsSousDoigt(e.clientX, e.clientY)
    if (trouve) {
      const { cible, index } = trouve
      if (outil?.kind === 'deplacer') {
        onSelectionner({ cible, index })
      } else if (outil?.kind === 'gomme') {
        if (cible === 'buse') retirerBuse(index)
        else if (cible === 'elevation') retirerElevation(index)
        else if (cible === 'separateur') retirerSeparateur(index)
        else if (cible === 'taille') retirerTaille(index)
        else retirerAppareil(index)
      } else if (outil?.kind === 'conformite') {
        if (cible === 'buse') definirConformiteBuse(index, outil.conforme)
        else if (cible === 'appareil' && appareils[index]?.buse) changerBuseSalamandre(index, { conforme: outil.conforme })
      } else if (cible === 'buse') {
        setBuseEdition({ index })
      } else if (cible === 'appareil') {
        setEdition({ index })
      } else if (cible === 'elevation') {
        retirerElevation(index)
      }
      return
    }
    // Mode Déplacer : taper un endroit vide y envoie l'élément sélectionné
    // (même rangée, seule la position horizontale change).
    if (modeDeplacer && selection) {
      const p = toSvgPoint(svgRef.current, e.clientX, e.clientY)
      onDeplacer(selection.cible, selection.index, p.x)
    }
  }

  // Mode Déplacer : l'élément sélectionné peut aussi être glissé au doigt.
  // Hors de ce mode, rien ne glisse — plus de déplacement accidentel ni de
  // conflit avec le défilement de la page.
  function surPointerDownSchema(e: React.PointerEvent<SVGSVGElement>) {
    if (!modeDeplacer || !selection) return
    const cibleDoigt = elementsSousDoigt(e.clientX, e.clientY)
      .find(t => t.cible === selection.cible && t.index === selection.index)
    if (!cibleDoigt) return
    const { n, cible, index } = cibleDoigt
    const xDepart = cible === 'buse' ? buses[index]?.x : cible === 'elevation' ? elevations[index]?.x : cible === 'separateur' ? dividers[index] : cible === 'taille' ? tailles[index]?.x : appareils[index]?.x
    if (xDepart === undefined) return
    const yCentre = cible === 'buse' ? yBuse(buses[index]) + 6 : cible === 'elevation' ? yElevation(elevations[index]) + 17 : cible === 'separateur' ? (BOX.topY + BOX.botY) / 2 : cible === 'taille' ? Y_TAILLE : yAppareil(appareils[index])
    demarrerGlisser(e, n, cible, index, xDepart, yCentre, x => {
      if (x !== null) onDeplacer(cible, index, x)
    })
  }

  // Doigt posé sur un élément déplaçable : la page n'a PAS le droit de
  // reprendre le geste pour défiler/zoomer (Safari iPad et certains
  // Android ignorent touch-action sur les éléments d'un SVG et annulaient
  // le glisser). Ailleurs sur le schéma, le défilement reste normal.
  // Écouteur natif non passif — React enregistre touchstart en passif.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function bloquerDefilement(ev: TouchEvent) {
      if ((ev.target as Element | null)?.closest?.('[data-glisser]')) ev.preventDefault()
    }
    svg.addEventListener('touchstart', bloquerDefilement, { passive: false })
    return () => svg.removeEventListener('touchstart', bloquerDefilement)
  }, [])


  return (
    <div className="border border-gray-100 rounded-md p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="text"
          disabled={readOnly}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={sauvegarderEntete}
          className="text-sm font-bold border-b border-transparent hover:border-gray-200 focus:border-[#dc2626] focus:outline-none px-1 py-0.5 disabled:bg-transparent"
          style={{ color: NAVY }}
        />
        <span className="text-xs font-bold text-gray-500">
          {nbBuses} buse{nbBuses !== 1 ? 's' : ''}
          {nbFusibles > 0 ? ` · ${nbFusibles} fusible${nbFusibles !== 1 ? 's' : ''}` : ''}
        </span>
        {!readOnly && (
          <button onClick={() => onDelete(hotte.id)} className="ml-auto text-xs font-bold text-gray-500 hover:text-red-500 flex items-center gap-1">
            <i className="ti ti-trash" /> Supprimer la hotte
          </button>
        )}
      </div>

      {/* Schéma responsive, le plus grand possible : toute la largeur
          disponible, hauteur proportionnelle (plus de hauteur fixe de
          296px) — sur tablette, buses et appareils deviennent bien plus
          gros sous le doigt. Plafonné à 75 % de la hauteur d'écran pour
          rester visible en entier sur ordinateur. Sur téléphone, largeur
          minimale lisible et défilement horizontal du schéma. */}
      <div className="flex items-stretch gap-3">
      <div className="relative flex-1 min-w-0 overflow-x-auto sm:overflow-visible" style={{ background: '#f8fafc', borderRadius: 10, border: '2px solid #94a3b8' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 512 ${VIEWBOX_H}`}
          preserveAspectRatio="none"
          className="w-full block"
          onPointerDown={surPointerDownSchema}
          onClick={surClicSchema}
          // Pas de sélection de texte ni de menu « appui long » iPad pendant
          // les gestes au doigt sur le schéma.
          style={{
            minWidth: 560,
            aspectRatio: `512 / ${VIEWBOX_H}`,
            height: 'auto',
            minHeight: 296,
            maxHeight: '75vh',
            overflow: 'visible',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          } as React.CSSProperties}
        >
          <defs>
            <linearGradient id={gradId.current} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="45%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <pattern id={`${gradId.current}-slats`} x={BOX.x0} y="0" width="10" height={BOX.botY - BOX.topY} patternUnits="userSpaceOnUse">
              <rect width="10" height={BOX.botY - BOX.topY} fill="#e2e8f0" />
              <rect width="4" height={BOX.botY - BOX.topY} fill="#cbd5e1" />
            </pattern>
          </defs>

          {/* Zone des élévations — cliquer au-dessus de la hotte place un
              conduit vertical à cet endroit. Rendue AVANT les élévations
              elles-mêmes pour qu'elles restent au-dessus et captent leurs
              propres clics/glissers (sinon cette zone les bloque). */}
          <rect x={0} y={0} width={512} height={BOX.topY - 14} fill="transparent"
            style={{ cursor: !readOnly && outil?.kind === 'elevation' ? 'copy' : 'default' }}
            onClick={placerElevation} />

          {/* Zone des buses extérieures — bande au-dessus des élévations,
              par-dessus la zone de clic « ajouter une élévation » pour ne pas
              la gêner, pour placer une buse à l'extérieur de la hotte (au
              niveau du raccord), en plus de celles du dessous et de
              l'intérieur. Repère pointillé pour la rendre visible : c'est de
              l'espace vide sinon, sans aucun indice. */}
          <line x1={BOX.x0} y1={22} x2={BOX.x1} y2={22} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
          {!readOnly && (
            <text x={BOX.x0} y={18} fill="#334155" fontSize={8.5} fontWeight={800} style={{ textTransform: 'uppercase', letterSpacing: 0.5, pointerEvents: 'none' }}>
              + buse extérieure
            </text>
          )}
          <rect x={0} y={6} width={512} height={32} fill="transparent"
            style={{ cursor: !readOnly && outil?.kind === 'buse' ? 'copy' : 'default' }}
            onClick={e => placerBuse(e, false, true)} />

          {/* Corps de la hotte — canopée métallique */}
          <polygon points={`${BOX.x0},${BOX.topY} ${BOX.x1},${BOX.topY} ${BOX.x1 + 20},${BOX.topY - 14} ${BOX.x0 + 20},${BOX.topY - 14}`} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={0.5} />
          <polygon points={`${BOX.x1},${BOX.topY} ${BOX.x1 + 20},${BOX.topY - 14} ${BOX.x1 + 20},${BOX.botY - 14} ${BOX.x1},${BOX.botY}`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.5} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={BOX.botY - BOX.topY} fill={`url(#${gradId.current}-slats)`} stroke="#94a3b8" strokeWidth={0.75} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={5} fill={`url(#${gradId.current})`} />
          <rect x={BOX.x0} y={BOX.botY - 4} width={BOX.x1 - BOX.x0} height={4} fill="#94a3b8" />


          {/* Élévations — conduits d'évacuation verticaux (raccords vers le
              toit), placés librement par le technicien (clic pour ajouter,
              glisser pour déplacer, cliquer sans glisser pour retirer).
              Rendues APRÈS le corps de la hotte pour que les élévations
              intérieures restent visibles par-dessus (sinon le fond opaque
              de la hotte les cache). */}
          {elevations.map((el, i) => {
            const enTrain = glisse?.cible === 'elevation' && glisse.index === i
            const x = el.x
            const y = yElevation(el)
            return (
              <g
                key={i}
                data-element={`elevation:${i}`}
                data-glisser={estSelectionne('elevation', i) ? '1' : undefined}
                data-cx={x}
                data-cy={y + 17}
                style={{ cursor: readOnly ? 'default' : estSelectionne('elevation', i) ? (enTrain ? 'grabbing' : 'grab') : 'pointer', touchAction: 'none' }}
              >
                {/* Zone de toucher invisible, plus large que le conduit. */}
                <rect x={x - 22} y={y - 6} width={44} height={46} fill="transparent" />
                {estSelectionne('elevation', i) && (
                  <rect x={x - 21} y={y - 5} width={42} height={44} rx={5} fill={BLEU_DEPLACER} fillOpacity={0.12} stroke={BLEU_DEPLACER} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </rect>
                )}
                <rect
                  x={x - 16}
                  y={y}
                  width={32}
                  height={34}
                  fill="#e2e8f0"
                  stroke={outil?.kind === 'gomme' ? '#475569' : '#94a3b8'}
                  strokeWidth={outil?.kind === 'gomme' ? 1.5 : 0.75}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}

          {/* Zone des buses — cliquer sous la hotte, juste au-dessus des
              appareils, ouvre le choix d'orientation puis place une buse à
              cet endroit (flèche rouge). Distincte de la zone des appareils,
              plus bas. */}
          <rect x={0} y={BOX.botY} width={512} height={BUSES_Y_MAX - BOX.botY} fill="transparent"
            style={{ cursor: !readOnly && outil?.kind === 'buse' ? 'copy' : 'default' }}
            onClick={e => placerBuse(e)} />
          <rect x={0} y={BUSES_Y_MAX} width={512} height={APPAREILS_Y_MAX - BUSES_Y_MAX} fill="transparent"
            style={{ cursor: !readOnly && outil?.kind === 'appareil' ? 'copy' : 'default' }}
            onClick={e => placerAppareil(e, 'below')} />
          <rect x={BOX.x0} y={BOX.topY} width={BOX.x1 - BOX.x0} height={BOX.botY - BOX.topY} fill="transparent"
            style={{ cursor: readOnly ? 'default' : outil?.kind === 'separateur' ? 'col-resize' : outil?.kind === 'taille' ? 'copy' : 'pointer' }} onClick={clicSurConduit} />

          {/* Repères visuels des zones cliquables — sinon rien n'indique où
              cliquer pour ajouter une buse ou un appareil. */}
          {!readOnly && (
            <>
              <line x1={0} y1={BUSES_Y_MAX} x2={512} y2={BUSES_Y_MAX} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
              <text x={BOX.x0} y={BOX.botY + 12} fill="#334155" fontSize={8.5} fontWeight={800} style={{ textTransform: 'uppercase', letterSpacing: 0.5, pointerEvents: 'none' }}>
                + buse
              </text>
              <text x={BOX.x0} y={BUSES_Y_MAX + 12} fill="#334155" fontSize={8.5} fontWeight={800} style={{ textTransform: 'uppercase', letterSpacing: 0.5, pointerEvents: 'none' }}>
                + appareil
              </text>
            </>
          )}

          {/* Zone des buses intérieures — fine bande au niveau du texte
              (milieu de la hotte), par-dessus la zone de division ci-dessus, pour
              placer des buses à l'intérieur de la hotte sans gêner le clic
              qui divise la hotte partout ailleurs sur le conduit. */}
          <rect x={BOX.x0} y={(BOX.topY + BOX.botY) / 2 - 15} width={BOX.x1 - BOX.x0} height={30} fill="transparent"
            style={{ cursor: !readOnly && (outil?.kind === 'buse' || outil?.kind === 'taille') ? 'copy' : !readOnly && outil?.kind === 'separateur' ? 'col-resize' : 'default' }}
            onClick={e => (outil?.kind === 'separateur' ? clicSurConduit(e) : outil?.kind === 'taille' ? placerTaille(e) : placerBuse(e, true))} />

          {/* Séparateurs — traits pleins sur toute la hauteur de la hotte.
              Tapables seulement en mode Déplacer / Retirer : le reste du
              temps, le tap sur la hotte passe à clicSurConduit (poser ou
              retirer un séparateur). */}
          {dividers.map((d, i) => {
            const enTrain = glisse?.cible === 'separateur' && glisse.index === i
            const actif = modeDeplacer || (!readOnly && outil?.kind === 'gomme')
            const yMilieu = (BOX.topY + BOX.botY) / 2
            return (
              <g key={i}
                data-element={`separateur:${i}`}
                data-glisser={estSelectionne('separateur', i) ? '1' : undefined}
                data-cx={d}
                data-cy={yMilieu}
                style={{ pointerEvents: actif ? 'auto' : 'none', cursor: estSelectionne('separateur', i) ? (enTrain ? 'grabbing' : 'grab') : 'pointer', touchAction: 'none' }}>
                {/* Zone de toucher invisible, bien plus large que le trait. */}
                <rect x={d - 14} y={BOX.topY} width={28} height={BOX.botY - BOX.topY} fill="transparent" />
                {estSelectionne('separateur', i) && (
                  <rect x={d - 12} y={BOX.topY - 3} width={24} height={BOX.botY - BOX.topY + 6} rx={5} fill={BLEU_DEPLACER} fillOpacity={0.12} stroke={BLEU_DEPLACER} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </rect>
                )}
                <line x1={d} y1={BOX.topY} x2={d} y2={BOX.botY} stroke={outil?.kind === 'gomme' ? '#475569' : '#334155'} strokeWidth={2.4} style={{ pointerEvents: 'none' }} />
              </g>
            )
          })}

          {/* Tailles de hotte — petits carrés « 6′ » en haut à l'intérieur de
              la hotte. Toujours tapables (sinon un tap dessus diviserait la
              hotte) ; déplaçables en mode Déplacer, retirées avec Retirer. */}
          {tailles.map((t, i) => {
            const enTrain = glisse?.cible === 'taille' && glisse.index === i
            return (
              <g key={i}
                data-element={`taille:${i}`}
                data-glisser={estSelectionne('taille', i) ? '1' : undefined}
                data-cx={t.x}
                data-cy={Y_TAILLE}
                style={{ cursor: readOnly ? 'default' : estSelectionne('taille', i) ? (enTrain ? 'grabbing' : 'grab') : 'pointer', touchAction: 'none' }}>
                <rect x={t.x - 16} y={Y_TAILLE - 16} width={32} height={32} fill="transparent" />
                {estSelectionne('taille', i) && (
                  <rect x={t.x - 15} y={Y_TAILLE - 15} width={30} height={30} rx={5} fill={BLEU_DEPLACER} fillOpacity={0.12} stroke={BLEU_DEPLACER} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </rect>
                )}
                <rect x={t.x - 10} y={Y_TAILLE - 10} width={20} height={20} fill="#fff" stroke={outil?.kind === 'gomme' ? '#475569' : '#334155'} strokeWidth={outil?.kind === 'gomme' ? 1.8 : 1.2} style={{ pointerEvents: 'none' }} />
                <text x={t.x} y={Y_TAILLE + 3.5} textAnchor="middle" fill={NAVY} fontSize={9.5} fontWeight={800} style={{ pointerEvents: 'none' }}>
                  {t.pieds}′
                </text>
              </g>
            )
          })}

          {/* Buses — flèches rouges placées manuellement, indépendantes du
              nombre d'appareils (glisser pour déplacer, cliquer sans glisser
              pour retirer) — même rendu que le PDF (_rendu_hotte_html).
              Droite (par défaut) = verticale ; gauche/droite = oblique, plus
              courte pour rester lisible à côté des droites. Les buses
              « intérieur » se placent au niveau du texte de la hotte plutôt
              que sous la hotte. */}
          {buses.map((buse, i) => {
            const enTrain = glisse?.cible === 'buse' && glisse.index === i
            const x = buse.x
            const y1 = yBuse(buse)
            const { shaft, tip } = traceBuse(x, y1, buse.direction)
            const couleur = buse.conforme === false ? BUSE_ROUGE : buse.direction === 'fusible' ? FUSIBLE_BLEU : BUSE_VERT
            // Palette rouge active : zone de tap agrandie et cerclée, pour
            // viser chaque buse sans effort au doigt.
            const zone = modeStatut ? 26 : 24
            return (
              <g key={i}
                data-element={`buse:${i}`}
                data-glisser={estSelectionne('buse', i) ? '1' : undefined}
                data-cx={x}
                data-cy={y1 + 6}
                style={{ cursor: readOnly ? 'default' : estSelectionne('buse', i) ? (enTrain ? 'grabbing' : 'grab') : 'pointer', touchAction: 'none' }}>
                {/* Zone de clic invisible, bien plus large que le trait visible
                    — un doigt ne peut pas viser précisément un trait de 2.4px.
                    Un rectangle rempli (même invisible) répond au toucher de
                    façon bien plus fiable qu'un trait sans remplissage sur
                    certains navigateurs tablette. */}
                <rect x={x - zone} y={y1 - zone} width={zone * 2} height={zone * 2} fill="transparent" />
                {estSelectionne('buse', i) && (
                  <circle cx={x} cy={y1 + 6} r={18} fill={BLEU_DEPLACER} fillOpacity={0.12} stroke={BLEU_DEPLACER} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                {modeStatut && (
                  <circle cx={x} cy={y1 + 6} r={14} fill={couleur} fillOpacity={0.1} stroke={couleur} strokeWidth={1} strokeDasharray="3 2" style={{ pointerEvents: 'none' }} />
                )}
                <path d={shaft} fill="none" stroke={couleur} strokeWidth={4} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                {tip && <polygon points={tip} fill={couleur} style={{ pointerEvents: 'none' }} />}
              </g>
            )
          })}

          {/* Appareils — rangée sous la hotte, avec leur position réelle et
              leur code affiché en titre sous chaque icône. La salamandre (S)
              est montée en hauteur (suspendue au-dessus de la ligne de
              cuisson) — toujours dessinée plus haut, jamais au même niveau
              que les autres appareils. */}
          {appareils.map((a, i) => {
            const enTrain = glisse?.cible === 'appareil' && glisse.index === i
            const x = a.x
            const iconY = yAppareil(a)
            const largeur = Math.max(largeurAppareil(a.code, a.qty || 1, a.taille) + 20, 52)
            return (
              <g key={i}
                data-element={`appareil:${i}`}
                data-glisser={estSelectionne('appareil', i) ? '1' : undefined}
                data-cx={x}
                data-cy={iconY}
                style={{ cursor: readOnly ? 'default' : estSelectionne('appareil', i) ? (enTrain ? 'grabbing' : 'grab') : 'pointer', touchAction: 'none' }}>
                {/* Zone de clic invisible, plus large que l'icône — un doigt
                    rate facilement un petit appareil sinon. */}
                <rect x={x - largeur / 2} y={iconY - 25} width={largeur} height={52} fill="transparent" />
                {estSelectionne('appareil', i) && (
                  <rect x={x - largeur / 2} y={iconY - 25} width={largeur} height={52} rx={6} fill={BLEU_DEPLACER} fillOpacity={0.1} stroke={BLEU_DEPLACER} strokeWidth={2} style={{ pointerEvents: 'none' }}>
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </rect>
                )}
                <g style={{ pointerEvents: 'none' }}>
                  <AppareilUnit code={a.code} qty={a.qty || 1} taille={a.taille} x={x} y={iconY} />
                  {a.code === 'S' && a.buse && (() => {
                    const { shaft, tip } = traceBuseSalamandre(x, iconY, a.buse)
                    const couleur = a.buse_conforme === false ? BUSE_ROUGE : BUSE_VERT
                    return (
                      <>
                        {modeStatut && <circle cx={x} cy={iconY + 1} r={14} fill={couleur} fillOpacity={0.1} stroke={couleur} strokeWidth={1} strokeDasharray="3 2" />}
                        <path d={shaft} fill="none" stroke={couleur} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                        <polygon points={tip} fill={couleur} />
                      </>
                    )
                  })()}
                  <text x={x} y={iconY + 24} textAnchor="middle" fill="#334155" fontSize={9} fontWeight={800}>
                    {libelleAppareil(a)}
                  </text>
                </g>
              </g>
            )
          })}

          {/* Repère vertical pendant un glisser — montre exactement où
              l'élément va tomber, même quand le doigt le cache. Déplacé
              directement par demarrerGlisser (attribut transform). */}
          {glisse && (
            <g
              ref={n => {
                repereRef.current = n
                n?.setAttribute('transform', `translate(${decalageRef.current} 0)`)
              }}
              style={{ pointerEvents: 'none' }}
            >
              <line x1={glisse.x0} y1={0} x2={glisse.x0} y2={VIEWBOX_H} stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="5 3" />
              <circle cx={glisse.x0} cy={VIEWBOX_H} r={4} fill="#0ea5e9" />
            </g>
          )}
        </svg>


        {buseEdition && buses[buseEdition.index] && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setBuseEdition(null)} />
            <div
              className="fixed z-50 left-1/2 top-1/2 bg-white p-3 rounded-xl shadow-2xl border border-gray-100 flex flex-col gap-2"
              style={{ transform: 'translate(-50%, -50%)', minWidth: 190 }}
            >
              <p className="text-xs font-bold" style={{ color: NAVY }}>Buse</p>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Conformité</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => definirConformiteBuse(buseEdition.index, true)}
                  className="flex-1 h-8 rounded-md border flex items-center justify-center gap-1 text-xs font-bold"
                  style={buses[buseEdition.index].conforme !== false ? { background: '#dcfce7', borderColor: BUSE_VERT, color: BUSE_VERT } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                >
                  <i className="ti ti-check" /> Conforme
                </button>
                <button
                  onClick={() => definirConformiteBuse(buseEdition.index, false)}
                  className="flex-1 h-8 rounded-md border flex items-center justify-center gap-1 text-xs font-bold"
                  style={buses[buseEdition.index].conforme === false ? { background: '#fee2e2', borderColor: BUSE_ROUGE, color: BUSE_ROUGE } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                >
                  <i className="ti ti-x" /> Non conforme
                </button>
              </div>
              <button
                onClick={() => retirerBuse(buseEdition.index)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center justify-center gap-1 pt-1 border-t border-gray-50"
              >
                <i className="ti ti-trash" /> Retirer
              </button>
            </div>
          </>
        )}

        {edition && appareils[edition.index] && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setEdition(null)} />
            <div
              className="fixed z-50 left-1/2 top-1/2 bg-white p-3 rounded-xl shadow-2xl border border-gray-100 flex flex-col gap-2"
              style={{ transform: 'translate(-50%, -50%)', minWidth: 190 }}
            >
              <p className="text-xs font-bold" style={{ color: NAVY }}>
                {CODE_LABEL[appareils[edition.index].code]}
                {appareils[edition.index].code === 'P' && ` — ${appareils[edition.index].taille || 24}″`}
              </p>
              {appareils[edition.index].code === 'S' && (() => {
                const a = appareils[edition.index]
                const choix: { sens: SensBuseSalamandre | null; label: string }[] = [
                  { sens: 'gauche', label: '<_|' }, { sens: 'droite', label: '|_>' }, { sens: null, label: 'Aucune' },
                ]
                return (
                  <>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Buse intérieure (90°)</label>
                    <div className="flex items-center gap-2">
                      {choix.map(c => {
                        const actif = (a.buse || null) === c.sens
                        return (
                          <button key={c.label} onClick={() => changerBuseSalamandre(edition.index, { buse: c.sens })}
                            className="flex-1 h-8 rounded-md border text-xs font-bold"
                            style={actif ? { background: '#fee2e2', borderColor: ORANGE, color: ORANGE } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                    {a.buse && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => changerBuseSalamandre(edition.index, { conforme: true })}
                          className="flex-1 h-8 rounded-md border flex items-center justify-center gap-1 text-xs font-bold"
                          style={a.buse_conforme !== false ? { background: '#dcfce7', borderColor: BUSE_VERT, color: BUSE_VERT } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                          <i className="ti ti-check" /> Conforme
                        </button>
                        <button onClick={() => changerBuseSalamandre(edition.index, { conforme: false })}
                          className="flex-1 h-8 rounded-md border flex items-center justify-center gap-1 text-xs font-bold"
                          style={a.buse_conforme === false ? { background: '#fee2e2', borderColor: BUSE_ROUGE, color: BUSE_ROUGE } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                          <i className="ti ti-x" /> Non conforme
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
              {appareils[edition.index].code === 'O' && (
                <>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Désignation</label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={40}
                    placeholder="Ex. : four à pizza"
                    defaultValue={appareils[edition.index].nom || ''}
                    onBlur={e => changerNom(edition.index, e.target.value.trim())}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="h-8 px-2 rounded-md border border-gray-200 text-sm font-bold focus:outline-none focus:border-[#dc2626]"
                    style={{ color: NAVY }}
                  />
                </>
              )}
              {appareils[edition.index].code === 'P' ? null : (
                <>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{QTY_LABEL[appareils[edition.index].code] || 'Quantité'}</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changerQuantite(edition.index, (appareils[edition.index].qty || 1) - 1)}
                      className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-sm font-bold hover:bg-gray-50"
                    >−</button>
                    <span className="flex-1 text-center text-sm font-bold" style={{ color: NAVY }}>{appareils[edition.index].qty || 1}</span>
                    <button
                      onClick={() => changerQuantite(edition.index, (appareils[edition.index].qty || 1) + 1)}
                      className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-sm font-bold hover:bg-gray-50"
                    >+</button>
                  </div>
                </>
              )}
              <button
                onClick={() => retirerAppareil(edition.index)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center justify-center gap-1 pt-1 border-t border-gray-50"
              >
                <i className="ti ti-trash" /> Retirer
              </button>
            </div>
          </>
        )}
      </div>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] font-bold text-gray-500">
          {appareils.length} appareil{appareils.length !== 1 ? 's' : ''}
          {dividers.length > 0 ? ` · ${dividers.length} division${dividers.length !== 1 ? 's' : ''}` : ''}
        </span>
        {!readOnly && (
          <button onClick={reinitialiser} className="text-[11px] font-bold text-gray-500 hover:text-[#dc2626]">
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}

export default function SchemaHottes({
  rapport,
  readOnly,
  onRefresh,
}: {
  rapport: any
  readOnly: boolean
  onRefresh: () => void
}) {
  const [ajout, setAjout] = useState(false)
  const [outil, setOutil] = useState<Outil | null>(null)

  // ── Sauvegarde optimiste — chaque modification du schéma s'affiche tout
  // de suite (copie locale par hotte), puis part au serveur en arrière-plan.
  // Avant : PATCH + rechargement complet du rapport à chaque geste, donc 1 à
  // 3 s d'attente sur réseau cellulaire, et l'élément revenait à son ancienne
  // place en attendant. Les changements rapprochés sont regroupés en un seul
  // envoi par hotte ; en cas d'échec réseau, nouvel essai automatique. ──
  const [locales, setLocales] = useState<Record<number, any>>({})
  const [statut, setStatut] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const enAttenteRef = useRef<Record<number, any>>({})
  const enVolRef = useRef(false)
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const essaisRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  const hottes: any[] = (rapport.hottes || []).map((h: any) => (locales[h.id] ? { ...h, ...locales[h.id] } : h))

  const [selection, setSelection] = useState<Selection | null>(null)

  // Tout changement d'outil efface la sélection du mode Déplacer.
  function changerOutil(o: Outil | null) {
    setOutil(o)
    setSelection(null)
  }

  function choisirOutil(o: Outil) {
    changerOutil(outilsEgaux(outil, o) ? null : o)
  }

  // Mode Déplacer — change seulement la position horizontale de l'élément
  // (il reste dans sa rangée). Buses et élévations sont retriées de gauche
  // à droite : la sélection suit l'élément à son nouvel index.
  function deplacerElement(hotteId: number, cible: Cible, index: number, x: number) {
    const h = hottes.find(ho => ho.id === hotteId)
    if (!h) return
    if (cible === 'separateur') {
      const liste: number[] = h.dividers || []
      if (liste[index] === undefined) return
      const nx = Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(x)))
      const next = liste.map((d, i) => (i === index ? nx : d)).sort((a, b) => a - b)
      patchHotte(hotteId, { dividers: next })
      setSelection({ hotteId, cible, index: next.indexOf(nx) })
      return
    }
    const cle = cible === 'buse' ? 'buses' : cible === 'elevation' ? 'elevations' : cible === 'taille' ? 'tailles' : 'appareils'
    const liste: { x: number }[] = h[cle] || []
    if (!liste[index]) return
    const deplace = { ...liste[index], x: Math.min(BOX.x1 - 8, Math.max(BOX.x0 + 8, Math.round(x))) }
    let next = liste.map((it, i) => (i === index ? deplace : it))
    if (cible !== 'appareil') next = [...next].sort((a, b) => a.x - b.x)
    patchHotte(hotteId, { [cle]: next })
    setSelection({ hotteId, cible, index: next.indexOf(deplace) })
  }

  // Boutons ◀ ▶ du bandeau : petit pas pour aligner précisément.
  function decalerSelection(dx: number) {
    if (!selection) return
    const h = hottes.find(ho => ho.id === selection.hotteId)
    if (selection.cible === 'separateur') {
      const d = h?.dividers?.[selection.index]
      if (d !== undefined) deplacerElement(selection.hotteId, 'separateur', selection.index, d + dx)
      return
    }
    const cle = selection.cible === 'buse' ? 'buses' : selection.cible === 'elevation' ? 'elevations' : selection.cible === 'taille' ? 'tailles' : 'appareils'
    const el = h?.[cle]?.[selection.index]
    if (el) deplacerElement(selection.hotteId, selection.cible, selection.index, el.x + dx)
  }

  function planifierEnvoi(delai: number) {
    if (minuterieRef.current) clearTimeout(minuterieRef.current)
    minuterieRef.current = setTimeout(envoyer, delai)
  }

  async function envoyer() {
    minuterieRef.current = null
    if (enVolRef.current) return // relancé à la fin de l'envoi en cours
    const lot = enAttenteRef.current
    const ids = Object.keys(lot).map(Number)
    if (ids.length === 0) return
    enAttenteRef.current = {}
    enVolRef.current = true
    const token = localStorage.getItem('access_token')
    const aReessayer: Record<number, any> = {}
    const refuses: number[] = []
    await Promise.all(ids.map(async id => {
      try {
        const res = await fetch(`${API_URL}/api/hottes-cuisine/${id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(lot[id]),
        })
        // 4xx (hors expiration/limite) : le serveur refuse, inutile de réessayer.
        if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) refuses.push(id)
        else if (!res.ok) aReessayer[id] = lot[id]
      } catch {
        aReessayer[id] = lot[id] // hors ligne / réseau coupé
      }
    }))
    enVolRef.current = false

    // Les échecs repassent SOUS les modifications faites entre-temps.
    for (const id of Object.keys(aReessayer).map(Number)) {
      enAttenteRef.current[id] = { ...aReessayer[id], ...enAttenteRef.current[id] }
    }
    if (refuses.length) {
      // Revenir à l'état du serveur pour ces hottes plutôt que d'afficher
      // un schéma qui n'a pas été enregistré.
      setLocales(prev => {
        const next = { ...prev }
        for (const id of refuses) delete next[id]
        return next
      })
    }
    if (Object.keys(aReessayer).length) {
      essaisRef.current += 1
      setStatut('error')
      planifierEnvoi(Math.min(15000, 1000 * 2 ** essaisRef.current))
      return
    }
    essaisRef.current = 0
    if (Object.keys(enAttenteRef.current).length) {
      planifierEnvoi(0)
      return
    }
    setStatut(refuses.length ? 'error' : 'saved')
    // Resynchronise le rapport en silence (compteurs ailleurs dans la page) —
    // l'affichage du schéma, lui, n'attend pas cette réponse.
    onRefreshRef.current()
  }

  function patchHotte(id: number, patch: any) {
    setLocales(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    enAttenteRef.current[id] = { ...enAttenteRef.current[id], ...patch }
    setStatut('saving')
    planifierEnvoi(400)
  }

  function reessayerMaintenant() {
    essaisRef.current = 0
    setStatut('saving')
    planifierEnvoi(0)
  }

  useEffect(() => {
    if (statut !== 'saved') return
    const t = setTimeout(() => setStatut('idle'), 2000)
    return () => clearTimeout(t)
  }, [statut])

  // Onglet fermé / page quittée avec des changements pas encore partis :
  // envoi immédiat en « keepalive » pour ne rien perdre.
  useEffect(() => {
    function vider() {
      const lot = enAttenteRef.current
      const ids = Object.keys(lot)
      if (ids.length === 0) return
      enAttenteRef.current = {}
      if (minuterieRef.current) clearTimeout(minuterieRef.current)
      const token = localStorage.getItem('access_token')
      for (const id of ids) {
        fetch(`${API_URL}/api/hottes-cuisine/${id}/`, {
          method: 'PATCH',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(lot[Number(id)]),
        }).catch(() => {})
      }
    }
    window.addEventListener('pagehide', vider)
    return () => {
      window.removeEventListener('pagehide', vider)
      vider()
    }
  }, [])

  async function supprimerHotte(id: number) {
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/hottes-cuisine/${id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    onRefresh()
  }

  async function ajouterHotte() {
    setAjout(true)
    const token = localStorage.getItem('access_token')
    await fetch(`${API_URL}/api/rapports-cuisine/${rapport.id}/hottes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
    setAjout(false)
    onRefresh()
  }

  const tousAppareils: Appareil[] = hottes.flatMap(h => h.appareils || [])
  // « Autre » : une entrée par désignation saisie, plutôt qu'un seul « Autre ».
  const legende = [
    ...Array.from(new Set(tousAppareils.filter(a => a.code !== 'O').map(a => a.code))).map(code => ({ code, texte: CODE_LABEL[code] || code })),
    ...Array.from(new Set(tousAppareils.filter(a => a.code === 'O').map(a => a.nom?.trim() || ''))).map(nom => ({ code: 'O', texte: nom ? `${nom} (autre)` : 'Autre' })),
  ]

  return (
    <div className="bg-white rounded-md border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Schéma d'installation</h3>
          {statut === 'saving' && (
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
              <i className="ti ti-loader-2 animate-spin" /> Enregistrement…
            </span>
          )}
          {statut === 'saved' && (
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: BUSE_VERT }}>
              <i className="ti ti-check" /> Enregistré
            </span>
          )}
          {statut === 'error' && (
            <button type="button" onClick={reessayerMaintenant} className="text-[11px] font-bold flex items-center gap-1" style={{ color: BUSE_ROUGE }}>
              <i className="ti ti-wifi-off" /> Réseau lent — nouvel essai auto · Réessayer
            </button>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={ajouterHotte}
            disabled={ajout}
            className="text-xs font-bold px-3 py-1.5 rounded-md text-white flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: ORANGE }}
          >
            <i className="ti ti-plus" /> Ajouter une hotte
          </button>
        )}
      </div>
      {!readOnly && (
        <>
          <p className="text-[11px] text-gray-400 mb-2">
            Choisissez un outil, puis tapez sur le schéma pour le poser — l'outil se désélectionne après chaque pose. Pour déplacer : « Déplacer », tapez l'élément, puis tapez l'endroit voulu (ou glissez-le). Palette rouge : tapez les buses une à une pour les marquer. Ces outils restent actifs jusqu'à « Terminé ». Sans outil, tapez un élément pour ses options, ou la hotte pour la diviser.
          </p>
          <div className="mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: BUSE_ROUGE }}>Conformité des buses</p>
            <div className="flex flex-wrap gap-1.5">
              {OUTILS_STATUT.map(o => {
                const actif = outilsEgaux(outil, o.outil)
                return (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => choisirOutil(o.outil)}
                    className="h-10 px-3 rounded-lg border-2 flex items-center gap-1.5 text-xs font-bold transition-colors"
                    style={actif
                      ? { background: o.couleur, borderColor: o.couleur, color: '#fff' }
                      : { background: o.fond, borderColor: o.couleur, color: o.couleur }}
                  >
                    <i className={`ti ${o.icon} text-base`} /> {o.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5">Buses, fusible, élévation, séparateur</p>
            <div className="flex flex-wrap gap-1.5">
              {OUTILS_BUSE.map(o => {
                const actif = outilsEgaux(outil, o.outil)
                return (
                  <button
                    key={o.label}
                    type="button"
                    title={o.label}
                    onClick={() => choisirOutil(o.outil)}
                    className="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors"
                    style={actif ? { background: '#fee2e2', borderColor: ORANGE, color: ORANGE } : { borderColor: '#94a3b8', color: '#000' }}
                  >
                    {o.icon}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5">Taille de hotte</p>
            <div className="flex flex-wrap gap-1.5">
              {TAILLES_HOTTE.map(pieds => {
                const o: Outil = { kind: 'taille', pieds }
                const actif = outilsEgaux(outil, o)
                return (
                  <button
                    key={pieds}
                    type="button"
                    title={`Hotte de ${pieds} pieds`}
                    onClick={() => choisirOutil(o)}
                    className="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-colors"
                    style={actif ? { background: '#fee2e2', borderColor: ORANGE, color: ORANGE } : { borderColor: '#94a3b8', color: '#000' }}
                  >
                    {pieds}′
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-1.5">Appareils</p>
            <div className="flex flex-wrap gap-1.5">
              {OUTILS_APPAREIL.map(o => {
                const actif = outilsEgaux(outil, o.outil)
                return (
                  <button
                    key={o.label}
                    type="button"
                    title={o.label}
                    onClick={() => choisirOutil(o.outil)}
                    className="h-10 px-2.5 rounded-lg border-2 flex items-center gap-1.5 text-xs font-bold transition-colors"
                    style={actif ? { background: '#fee2e2', borderColor: ORANGE, color: ORANGE } : { borderColor: '#94a3b8', color: '#000' }}
                  >
                    <AppareilIcon code={o.outil.kind === 'appareil' ? o.outil.code : ''} buse={o.outil.kind === 'appareil' ? o.outil.buse : undefined} color={actif ? ORANGE : '#000'} size={15} />
                    {o.outil.kind === 'appareil' && o.outil.taille ? `${o.outil.taille}″` : o.label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!readOnly && outil && (
        // Rappel de l'outil actif, collé en haut à l'écran pendant qu'on
        // fait défiler les hottes — et bouton pour en sortir.
        <div
          className="sticky top-2 z-30 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg shadow-md text-xs font-bold text-white"
          style={{ background: outil.kind === 'conformite' ? (outil.conforme ? BUSE_VERT : BUSE_ROUGE) : outil.kind === 'gomme' ? '#475569' : outil.kind === 'deplacer' ? BLEU_DEPLACER : NAVY }}
        >
          <i className={`ti ${outil.kind === 'deplacer' ? 'ti-arrows-move' : estOutilStatut(outil) ? 'ti-hand-finger' : 'ti-pointer'} text-base`} />
          <span className="flex-1">
            {outil.kind === 'conformite'
              ? `Tapez les buses à marquer ${outil.conforme ? 'conformes' : 'non conformes'}`
              : outil.kind === 'gomme'
                ? 'Tapez un élément pour le retirer'
                : outil.kind === 'deplacer'
                  ? (selection
                    ? 'Tapez l\'endroit voulu (ou glissez l\'élément) — ◀ ▶ pour ajuster'
                    : 'Tapez l\'élément à déplacer (buse, appareil, élévation, séparateur, taille)')
                  : outil.kind === 'separateur'
                    ? 'Tapez la hotte à l\'endroit où la séparer (près d\'un séparateur pour le retirer)'
                    : outil.kind === 'taille'
                      ? `Tapez à l'intérieur de la hotte pour poser ${outil.pieds}′`
                      : 'Tapez sur le schéma pour poser l\'élément'}
          </span>
          {outil.kind === 'deplacer' && selection && (
            <>
              <button type="button" onClick={() => decalerSelection(-4)} aria-label="Décaler à gauche" className="h-9 w-11 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <i className="ti ti-chevron-left text-lg" />
              </button>
              <button type="button" onClick={() => decalerSelection(4)} aria-label="Décaler à droite" className="h-9 w-11 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <i className="ti ti-chevron-right text-lg" />
              </button>
            </>
          )}
          <button type="button" onClick={() => changerOutil(null)} className="h-9 px-3 rounded-md bg-white/20 hover:bg-white/30">
            {estOutilPersistant(outil) ? 'Terminé' : 'Annuler'}
          </button>
        </div>
      )}

      {hottes.length === 0 ? (
        <p className="text-sm text-gray-300 italic py-6 text-center">Aucune hotte enregistrée.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {hottes.map(h => (
            <HotteEditor
              key={h.id}
              hotte={h}
              readOnly={readOnly}
              onPatch={patchHotte}
              onDelete={supprimerHotte}
              outil={outil}
              onOutilUtilise={() => changerOutil(null)}
              selection={selection && selection.hotteId === h.id ? { cible: selection.cible, index: selection.index } : null}
              onSelectionner={s => setSelection({ hotteId: h.id, ...s })}
              onDeplacer={(cible, index, x) => deplacerElement(h.id, cible, index, x)}
            />
          ))}
        </div>
      )}

      {legende.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
          {legende.map(({ code, texte }) => (
            <div key={`${code}-${texte}`} className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50">
                <AppareilIcon code={code} color="#64748b" size={13} />
              </span>
              <span className="text-xs font-bold text-gray-700">{texte}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
