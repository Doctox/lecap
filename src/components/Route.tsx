import { useEffect, useRef } from 'react'
import type { Tier, TierEvent } from '../lib/types'

// La route des paliers : le tracé sur la carte. Sept coffres, du premier au
// boss final. Verrouillé, on ne voit qu'un « ? » et le nombre d'XP à atteindre —
// jamais ce qu'il y a dedans.

type Props = { paliers: Tier[]; coffres: TierEvent[]; xp: number }

export function Route({ paliers, coffres, xp }: Props) {
  const piste = useRef<HTMLDivElement>(null)

  // On cadre sur le prochain coffre, pas sur le début du voyage.
  const indexCourant = Math.max(
    0,
    paliers.findIndex((t) => t.points > xp),
  )

  useEffect(() => {
    const etape = piste.current?.children[indexCourant] as HTMLElement | undefined
    etape?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [indexCourant])

  if (paliers.length === 0) return null

  return (
    <div className="carte">
      <h2>La route</h2>
      <div className="route" ref={piste}>
        {paliers.map((t, i) => {
          const evenement = coffres.find((c) => c.tier_points === t.points)
          const etat = !evenement
            ? 'verrouille'
            : evenement.delivered_at
              ? 'ouvert'
              : 'atteint'
          return (
            <div key={t.points} className="etape" data-etat={etat}>
              {i === indexCourant && etat === 'verrouille' && <span className="ici">▾</span>}
              <div
                className="coffre-noeud"
                title={etat === 'verrouille' ? `${t.points} XP — ${t.label}` : t.label}
              >
                {etat === 'verrouille' ? '?' : '★'}
              </div>
              <span className="etape-xp">{t.points}</span>
            </div>
          )
        })}
      </div>
      <p className="faible" style={{ margin: '4px 0 0' }}>
        {paliers.some((t) => t.points > xp)
          ? `Prochain coffre à ${paliers.find((t) => t.points > xp)?.points} XP.`
          : 'Tous les coffres sont franchis.'}{' '}
        Ce qu'il y a dedans, tu ne le sauras qu'en l'ouvrant.
      </p>
    </div>
  )
}
