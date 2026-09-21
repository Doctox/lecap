import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { xpForLevel } from '../lib/levels'
import { CoffreIcone } from './CoffreIcone'
import type { Tier, TierEvent } from '../lib/types'

// Le réglage des coffres, réservé au binôme : combien, où, et comment ils
// s'appellent.
//
// Chaque ligne garde son ANCIEN niveau — c'est ce qui permet à sa récompense et
// à son historique de la suivre quand on déplace ou qu'on retire un voisin.
// Sans ça, retirer le troisième coffre décalerait les surprises des suivants.

type Ligne = { ancien: number; niveau: number; libelle: string }

type Props = {
  pactId: string
  paliers: Tier[]
  evenements: TierEvent[]
  onRetour: () => void
  onFait: () => void
}

/** Jours nécessaires à +1 XP par jour, sans la moindre quête. */
function joursSansBonus(niveau: number) {
  return Math.max(1, xpForLevel(niveau))
}

export function Repartition({ pactId, paliers, evenements, onRetour, onFait }: Props) {
  const [lignes, setLignes] = useState<Ligne[]>(
    paliers.map((t) => ({ ancien: t.level, niveau: t.level, libelle: t.label })),
  )
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const franchi = (ancien: number) =>
    ancien > 0 && evenements.some((e) => e.tier_level === ancien)

  // On garde la suite strictement croissante en poussant les voisins : l'écran
  // ne doit jamais proposer un état que la base refusera.
  function remettreEnOrdre(suite: Ligne[], depuis: number): Ligne[] {
    const r = suite.map((l) => ({ ...l }))
    for (let i = depuis + 1; i < r.length; i++) {
      r[i].niveau = Math.max(r[i].niveau, r[i - 1].niveau + 1)
    }
    for (let i = Math.min(depuis, r.length - 1) - 1; i >= 0; i--) {
      r[i].niveau = Math.min(r[i].niveau, r[i + 1].niveau - 1)
    }
    return r.map((l) => ({ ...l, niveau: Math.max(2, l.niveau) }))
  }

  function bouger(index: number, pas: number) {
    setLignes((anciennes) => {
      const suite = anciennes.map((l) => ({ ...l }))
      suite[index].niveau = Math.max(2, suite[index].niveau + pas)
      return remettreEnOrdre(suite, index)
    })
  }

  function renommer(index: number, texte: string) {
    setLignes((anciennes) =>
      anciennes.map((l, i) => (i === index ? { ...l, libelle: texte.slice(0, 60) } : l)),
    )
  }

  function ajouter() {
    setLignes((anciennes) => {
      const dernier = anciennes[anciennes.length - 1]?.niveau ?? 1
      return [
        ...anciennes,
        { ancien: 0, niveau: dernier + 2, libelle: `Coffre ${anciennes.length + 1}` },
      ]
    })
  }

  function retirer(index: number) {
    setLignes((anciennes) => anciennes.filter((_, i) => i !== index))
  }

  function appliquer(preset: number[]) {
    setLignes((anciennes) =>
      remettreEnOrdre(
        anciennes.map((l, i) => ({
          ...l,
          niveau: preset[i] ?? (preset[preset.length - 1] ?? 2) + (i - preset.length + 1) * 3,
        })),
        0,
      ),
    )
  }

  async function enregistrer() {
    setOccupe(true)
    setErreur(null)
    const { error } = await supabase.rpc('definir_paliers', {
      p: pactId,
      anciens: lignes.map((l) => l.ancien),
      niveaux: lignes.map((l) => l.niveau),
      libelles: lignes.map((l) => l.libelle.trim() || 'Coffre'),
    })
    setOccupe(false)
    if (error) return setErreur(error.message)
    onFait()
  }

  const dernier = lignes[lignes.length - 1]?.niveau ?? 2

  return (
    <div className="fenetre">
      <h2>Réglage des coffres</h2>

      {erreur && <div className="avis">{erreur}</div>}

      <p className="faible" style={{ marginTop: 0 }}>
        Les jours indiqués supposent une journée déclarée par jour,{' '}
        <b>sans aucune quête</b>. Avec des quêtes, c&rsquo;est plus rapide.
      </p>

      <div className="onglets-fenetre">
        <button
          className="onglet-fenetre"
          aria-selected={dernier <= 8}
          onClick={() => appliquer([2, 3, 4, 5, 6, 7, 8])}
        >
          Un mois
        </button>
        <button
          className="onglet-fenetre"
          aria-selected={dernier > 8 && dernier <= 14}
          onClick={() => appliquer([2, 4, 6, 8, 10, 12, 14])}
        >
          Trois mois
        </button>
        <button
          className="onglet-fenetre"
          aria-selected={dernier > 14}
          onClick={() => appliquer([3, 5, 8, 11, 15, 20, 28])}
        >
          Un an
        </button>
      </div>

      {lignes.map((l, i) => (
        <div key={`${l.ancien}-${i}`} className="ligne-coffre">
          <div className="ligne-coffre-haut">
            <CoffreIcone etat={franchi(l.ancien) ? 'remis' : 'pret'} taille={26} />
            <input
              value={l.libelle}
              onChange={(e) => renommer(i, e.target.value)}
              aria-label={`Nom du coffre ${i + 1}`}
            />
            <button
              className="retirer"
              onClick={() => retirer(i)}
              disabled={franchi(l.ancien) || lignes.length <= 1}
              aria-label={`Retirer ${l.libelle}`}
              title={
                franchi(l.ancien)
                  ? 'Déjà franchi — il reste dans son journal'
                  : 'Retirer ce coffre'
              }
            >
              ×
            </button>
          </div>

          <div className="ligne-coffre-bas">
            <span className="faible">
              {xpForLevel(l.niveau)} XP · vers le jour {joursSansBonus(l.niveau)}
            </span>
            <div className="reglage">
              <button onClick={() => bouger(i, -1)} disabled={l.niveau <= 2} aria-label="Rapprocher">
                −
              </button>
              <span className="valeur">niv. {l.niveau}</span>
              <button onClick={() => bouger(i, 1)} aria-label="Éloigner">
                +
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        className="discret"
        onClick={ajouter}
        disabled={lignes.length >= 12}
        style={{ marginTop: 12 }}
      >
        + Ajouter un coffre
      </button>

      <button
        className="action-jeu"
        onClick={enregistrer}
        disabled={occupe}
        style={{ marginTop: 14 }}
      >
        Enregistrer
        <span className="sous">
          {lignes.length} coffre{lignes.length > 1 ? 's' : ''} · dernier vers le jour{' '}
          {joursSansBonus(dernier)}
        </span>
      </button>

      <p className="faible" style={{ marginTop: 12 }}>
        Rapprocher un coffre déjà dépassé l&rsquo;ouvre aussitôt. En éloigner un
        qu&rsquo;il a franchi ne le referme pas, et un coffre déjà franchi ne se
        retire pas : ce qui est acquis reste acquis.
      </p>

      <button className="fantome" onClick={onRetour}>
        ← Tous les coffres
      </button>
    </div>
  )
}
