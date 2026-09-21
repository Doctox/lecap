import type { Bonus, Day, Situation, Tier, TierEvent } from '../lib/types'

// Le journal de bord, partagé par les deux écrans.
//
// Un écart y apparaît comme une journée, jamais comme une faute : même carte,
// même place, une gemme d'ardoise au lieu d'une gemme colorée. Ni rouge, ni
// croix, ni ligne barrée. C'est la règle du brief, et elle tient ici autant
// que sur l'écran de déclaration.

type Props = {
  jours: Day[]
  bonus: Bonus[]
  bareme: Situation[]
  paliers: Tier[]
  coffres: TierEvent[]
  /** Le binôme voit les mots ; le joueur les a déjà écrits. */
  avecMots?: boolean
}

function rarete(points: number) {
  return points >= 5 ? 'epique' : points >= 3 ? 'rare' : 'commune'
}

export function Journal({ jours, bonus, bareme, paliers, coffres, avecMots }: Props) {
  if (jours.length === 0) {
    return (
      <div className="fenetre">
        <h2>Le journal de bord</h2>
        <p className="faible" style={{ marginBottom: 0 }}>
          Rien encore. La première journée déclarée ouvrira le journal.
        </p>
      </div>
    )
  }

  return (
    <div className="fenetre">
      <h2>Le journal de bord</h2>
      <div className="quetes">
        {jours.map((j) => {
          const gains = bonus.filter((b) => b.day_id === j.id)
          const total = gains.reduce((n, b) => n + b.points, 0) + (j.status === 'zero' ? 1 : 0)
          const coffre = coffres.find((c) => c.reached_at.slice(0, 10) === j.day)
          const palier = paliers.find((p) => p.level === coffre?.tier_level)
          const quetes = j.situations
            .map((k) => bareme.find((s) => s.key === k))
            .filter((s): s is Situation => Boolean(s))

          return (
            <div key={j.id} className="jour">
              <div className="jour-haut">
                <span
                  className="gemme"
                  data-rarete={j.status === 'zero' ? 'commune' : undefined}
                  style={j.status === 'zero' ? undefined : { background: 'var(--ardoise)' }}
                >
                  {j.status === 'zero' ? '✓' : '·'}
                </span>
                <span className="libelle">
                  {new Date(j.day).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  {j.status === 'ecart' && (
                    <span className="faible"> · journée avec</span>
                  )}
                  {!j.validated_at && j.status === 'zero' && quetes.length > 0 && (
                    <span className="faible"> · en attente d’arbitrage</span>
                  )}
                </span>
                <span className="gain-plaque">{total > 0 ? `+${total}` : '—'}</span>
              </div>

              {quetes.length > 0 && (
                <div className="jour-quetes">
                  {quetes.map((s) => (
                    <span key={s.key} className="jeton" data-rarete={rarete(s.points)}>
                      {s.label}
                    </span>
                  ))}
                </div>
              )}

              {palier && (
                <>
                  <p className="jour-coffre">
                    ★ Coffre du niveau {palier.level} — {palier.label}
                  </p>
                  {coffre?.contenu_revele && (
                    <p className="jour-mot">🎁 {coffre.contenu_revele}</p>
                  )}
                </>
              )}

              {avecMots && j.note && <p className="jour-mot">« {j.note} »</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
