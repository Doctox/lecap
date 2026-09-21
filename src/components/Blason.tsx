import { useState } from 'react'
import { avatarPour, levelFromXp, rankLabel } from '../lib/levels'
import type { Progress } from '../lib/types'

// La fiche de personnage : anneau de niveau autour de la boussole, plaque de
// rang gravée, jauge crantée et trois gemmes. Ce n'est plus un tableau de bord.

export function Blason({ progres }: { progres: Progress | null }) {
  const xp = progres?.total ?? 0
  const n = levelFromXp(xp)

  // L'avatar du rang s'il existe, la boussole sinon. Un fichier manquant ne
  // casse rien : on peut donc ajouter les douze portraits un par un.
  const [avatarManquant, setAvatarManquant] = useState(false)
  const portrait = avatarManquant
    ? `${import.meta.env.BASE_URL}logo-320.png`
    : avatarPour(n.level)

  return (
    <div className="blason">
      <div className="blason-haut">
        <div className="anneau" style={{ ['--p' as string]: Math.round(n.ratio * 100) }}>
          <div className="creux">
            <img
              key={portrait}
              src={portrait}
              alt=""
              className={avatarManquant ? undefined : 'portrait'}
              onError={() => setAvatarManquant(true)}
            />
          </div>
          <span className="niveau-pastille">{n.level}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="plaque">{rankLabel(n)}</span>
          <div className="xp-ligne">
            <span className="nombre">{xp}</span>
            <span className="doux" style={{ fontWeight: 800 }}>
              XP
            </span>
          </div>
          <p className="faible" style={{ margin: '4px 0 0' }}>
            {n.xpToNext} XP avant le niveau {n.level + 1}
          </p>
        </div>
      </div>

      <div className="jauge">
        <i style={{ width: `${Math.round(n.ratio * 100)}%` }} />
      </div>

      <div className="gemmes">
        <div className="gemme-stat">
          <span className="glyphe">🔥</span>
          <b>{progres?.current_streak ?? 0}</b>
          <span>Série</span>
        </div>
        <div className="gemme-stat">
          <span className="glyphe">🏅</span>
          <b>{progres?.best_streak ?? 0}</b>
          <span>Record</span>
        </div>
        <div className="gemme-stat">
          <span className="glyphe">⚓</span>
          <b>{progres?.zero_days ?? 0}</b>
          <span>Jours</span>
        </div>
      </div>
    </div>
  )
}
