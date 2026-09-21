import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Pact } from '../lib/types'

// « Suppression du pacte et de tout son contenu en un geste, par l'un ou
// l'autre. » Un geste, mais pas un faux mouvement : on demande confirmation
// une fois, et c'est définitif.

// Les quatre services nationaux, vérifiés sur leurs sites officiels.
// Le Cap ne conseille rien et n'oriente vers rien : il donne les numéros.
const AIDES = [
  {
    nom: 'Alcool Info Service',
    numero: '0 980 980 930',
    tel: '0980980930',
    detail: '7j/7 de 8h à 2h · anonyme, non surtaxé',
  },
  {
    nom: 'Tabac Info Service',
    numero: '39 89',
    tel: '3989',
    detail: 'Arrêt du tabac',
  },
  {
    nom: 'Drogues Info Service',
    numero: '0 800 23 13 13',
    tel: '0800231313',
    detail: '7j/7',
  },
  {
    nom: 'Joueurs Info Service',
    numero: '09 74 75 13 13',
    tel: '0974751313',
    detail: "7j/7 · jeux d'argent",
  },
]

type Props = { pact: Pact; onRetour: () => void; onEfface: () => void }

export default function Reglages({ pact, onRetour, onEfface }: Props) {
  const base = import.meta.env.BASE_URL
  const [confirme, setConfirme] = useState(false)
  const [occupe, setOccupe] = useState(false)

  async function effacer() {
    setOccupe(true)
    await supabase.rpc('delete_pact', { p: pact.id })
    setOccupe(false)
    onEfface()
  }

  return (
    <div className="ecran">
      <div className="entete">
        <div className="marque">Réglages</div>
        <button className="fantome" onClick={onRetour}>
          ← Retour
        </button>
      </div>

      <div className="carte">
        <h2>Votre duo</h2>
        <p className="faible" style={{ marginBottom: 6 }}>
          Code de duo
        </p>
        <div className="code" style={{ textAlign: 'left', fontSize: '1.2rem' }}>
          {pact.join_code}
        </div>
      </div>

      <div className="carte">
        <h2>Se déconnecter</h2>
        <p className="doux">Tes données restent, la partie t'attend.</p>
        <button className="discret" onClick={() => supabase.auth.signOut()}>
          Me déconnecter
        </button>
      </div>

      <div className="carte">
        <h2>Tout effacer</h2>
        <p className="doux">
          L'XP, les journées, les mots, les coffres et leur contenu : tout part,
          des deux côtés, sans copie. L'un comme l'autre peut le faire, et ça ne
          se rattrape pas.
        </p>
        {confirme ? (
          <>
            <button
              className="principal"
              style={{ background: 'var(--ardoise)', color: 'var(--encre)', boxShadow: 'none' }}
              onClick={effacer}
              disabled={occupe}
            >
              Oui, tout effacer
            </button>
            <button className="fantome" onClick={() => setConfirme(false)}>
              Finalement non
            </button>
          </>
        ) : (
          <button className="discret" onClick={() => setConfirme(true)}>
            Effacer le duo et tout son contenu
          </button>
        )}
      </div>

      <div className="carte">
        <h2>Ce que Le Cap n'est pas</h2>
        <p className="doux">
          Un jeu à deux, rien de plus. Pas un suivi médical, pas un diagnostic,
          aucune promesse.
        </p>
        <p className="faible">
          Si tu veux en parler à quelqu'un dont c'est le métier, quelle que soit
          l'addiction — c'est gratuit, et personne ici n'en saura rien.
        </p>
        <div className="quetes">
          {AIDES.map((a) => (
            <a key={a.numero} className="quete-jeu" href={`tel:${a.tel}`}>
              <span className="libelle">
                <b>{a.nom}</b>
                <br />
                <span className="faible">{a.detail}</span>
              </span>
              <span className="gain-plaque">{a.numero}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="carte">
        <h2>Les textes</h2>
        <p className="faible" style={{ marginBottom: 12 }}>
          Ce que l'application conserve, qui peut le lire, et comment tout
          effacer.
        </p>
        <div className="rangee">
          <a className="fantome" href={`${base}legal/confidentialite.html`} target="_blank" rel="noreferrer">
            Confidentialité
          </a>
          <a className="fantome" href={`${base}legal/mentions-legales.html`} target="_blank" rel="noreferrer">
            Mentions légales
          </a>
        </div>
      </div>
    </div>
  )
}
