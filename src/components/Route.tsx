import { useEffect, useRef } from 'react'
import type { Tier, TierEvent } from '../lib/types'

// La route des paliers : le tracé sur la carte. Sept coffres, du premier au
// boss final. Verrouillé, on ne voit qu'un « ? » et le nombre d'XP à atteindre —
// jamais ce qu'il y a dedans.

type Props = { paliers: Tier[]; coffres: TierEvent[]; niveau: number }

export function Route({ paliers, coffres, niveau }: Props) {
  const piste = useRef<HTMLDivElement>(null)

  // On cadre sur le prochain coffre, pas sur le début du voyage.
  const indexCourant = Math.max(
    0,
    paliers.findIndex((t) => t.level > niveau),
  )

  useEffect(() => {
    const etape = piste.current?.children[indexCourant] as HTMLElement | undefined
    etape?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [indexCourant])

  if (paliers.length === 0) return null

  return (
    <div className="fenetre">
      <h2>La route</h2>
      <div className="route" ref={piste}>
        {paliers.map((t, i) => {
          const evenement = coffres.find((c) => c.tier_level === t.level)
          const etat = !evenement
            ? 'verrouille'
            : evenement.delivered_at
              ? 'ouvert'
              : 'atteint'
          return (
            <div key={t.level} className="etape" data-etat={etat}>
              {i === indexCourant && etat === 'verrouille' && <span className="ici">▾</span>}
              <div
                className="coffre-noeud"
                title={etat === 'verrouille' ? `Niveau ${t.level} — ${t.label}` : t.label}
              >
                {etat === 'verrouille' ? '?' : '★'}
              </div>
              <span className="etape-xp">niv. {t.level}</span>
            </div>
          )
        })}
      </div>
      <p className="faible" style={{ margin: '4px 0 0' }}>
        {paliers.some((t) => t.level > niveau)
          ? `Prochain coffre au niveau ${paliers.find((t) => t.level > niveau)?.level}.`
          : 'Tous les coffres sont franchis.'}{' '}
        Ce qu'il y a dedans, tu ne le sauras qu'en l'ouvrant.
      </p>
    </div>
  )
}
