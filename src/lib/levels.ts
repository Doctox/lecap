// Le Cap — la courbe d'XP et les rangs.
//
// Deux progressions cohabitent dans le jeu, et il ne faut pas les confondre :
//
//   · les NIVEAUX, ici. Connus d'avance, calculés côté navigateur, ils montent
//     souvent et ne redescendent jamais. C'est le retour immédiat, la petite
//     récompense gratuite. Aucun secret là-dedans.
//
//   · les PALIERS, en base. Sept marches, une récompense secrète derrière
//     chacune, préparée par le binôme. C'est le gros lot, et lui ne le voit pas.
//
// Les premiers niveaux tombent vite — trois jours, et on est déjà Matelot.
// Ensuite la courbe s'étire, sans jamais devenir un mur.

const RANKS = [
  'Mousse',
  'Matelot',
  'Gabier',
  'Timonier',
  'Navigateur',
  'Quartier-maître',
  'Second',
  'Capitaine',
  'Cap-hornier',
  'Doubleur de caps',
  'Maître à bord',
  'Grand Cap',
] as const

/** XP nécessaire pour atteindre le niveau n (n commence à 1, seuil 0). */
export function xpForLevel(n: number): number {
  if (n <= 1) return 0
  return Math.round(1.4 * ((n * (n - 1)) / 2))
}

export type Level = {
  level: number
  rank: string
  /** Étoiles au-delà du dernier rang nommé : Grand Cap ★, ★★, … */
  stars: number
  xpFloor: number
  xpNext: number
  /** Progression dans le niveau en cours, de 0 à 1. */
  ratio: number
  xpToNext: number
}

export function levelFromXp(xp: number): Level {
  const safe = Math.max(0, Math.floor(xp))
  let level = 1
  while (xpForLevel(level + 1) <= safe) level++

  const xpFloor = xpForLevel(level)
  const xpNext = xpForLevel(level + 1)
  const span = Math.max(1, xpNext - xpFloor)

  const namedIndex = Math.min(level, RANKS.length) - 1
  const stars = level > RANKS.length ? Math.ceil((level - RANKS.length) / 3) : 0

  return {
    level,
    rank: RANKS[namedIndex],
    stars,
    xpFloor,
    xpNext,
    ratio: Math.min(1, (safe - xpFloor) / span),
    xpToNext: Math.max(0, xpNext - safe),
  }
}

export function rankLabel(l: Level): string {
  return l.stars > 0 ? `${l.rank} ${'★'.repeat(Math.min(l.stars, 5))}` : l.rank
}

/** Nombre de rangs nommés, donc d'avatars attendus. */
export const NOMBRE_DE_RANGS = RANKS.length

/**
 * L'avatar du rang, dans public/avatars/. Un fichier manquant n'est pas une
 * erreur : le blason retombe sur la boussole, et le jeu continue.
 */
export function avatarPour(level: number): string {
  const rang = Math.min(Math.max(1, level), RANKS.length)
  return `${import.meta.env.BASE_URL}avatars/rang-${String(rang).padStart(2, '0')}.png`
}
