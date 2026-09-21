import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// Google ou Discord. Pas de compte invité, pas de mot de passe :
// aucun identifiant ne transite par l'application, on ne reçoit qu'un jeton.

type Fournisseur = 'google' | 'discord'

const FOURNISSEURS: {
  cle: Fournisseur
  nom: string
  teinte: string
  icone: ReactNode
}[] = [
  {
    cle: 'google',
    nom: 'Google',
    teinte: '#ffffff',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.5 12.25c0-.8-.07-1.56-.2-2.29H12v4.33h5.88a5.03 5.03 0 0 1-2.18 3.3v2.75h3.53c2.06-1.9 3.27-4.7 3.27-8.09Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.95 0 5.43-.98 7.23-2.66l-3.53-2.74c-.98.66-2.23 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.23v2.82A10.99 10.99 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.88 14.15a6.6 6.6 0 0 1 0-4.29V7.04H2.23a11 11 0 0 0 0 9.93l3.65-2.82Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.4c1.6 0 3.05.55 4.19 1.64l3.13-3.13C17.43 2.14 14.95 1 12 1 7.7 1 3.99 3.47 2.23 7.04l3.65 2.82C6.74 7.3 9.15 5.4 12 5.4Z"
        />
      </svg>
    ),
  },
  {
    cle: 'discord',
    nom: 'Discord',
    teinte: '#5865F2',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M19.27 5.33A16.5 16.5 0 0 0 15.2 4.1a.06.06 0 0 0-.07.03c-.17.32-.37.73-.51 1.05a15.3 15.3 0 0 0-4.24 0c-.14-.33-.35-.73-.53-1.05a.06.06 0 0 0-.06-.03c-1.4.24-2.77.67-4.07 1.23a.06.06 0 0 0-.03.02C2.18 9.3 1.42 13.13 1.8 16.92a.07.07 0 0 0 .03.05 16.6 16.6 0 0 0 4.99 2.5.07.07 0 0 0 .07-.02c.38-.52.73-1.07 1.02-1.65a.06.06 0 0 0-.03-.09c-.54-.2-1.05-.45-1.55-.73a.06.06 0 0 1 0-.11l.3-.24a.06.06 0 0 1 .07 0 11.9 11.9 0 0 0 10.1 0 .06.06 0 0 1 .06 0l.31.24a.06.06 0 0 1 0 .1c-.5.3-1.01.54-1.55.74a.06.06 0 0 0-.04.09c.3.58.65 1.13 1.03 1.65a.06.06 0 0 0 .07.02 16.55 16.55 0 0 0 5-2.5.07.07 0 0 0 .02-.05c.46-4.38-.73-8.18-3.1-11.56a.05.05 0 0 0-.03-.03ZM8.53 14.62c-.99 0-1.8-.9-1.8-2.01s.8-2.02 1.8-2.02c1 0 1.81.91 1.8 2.02 0 1.1-.8 2.01-1.8 2.01Zm6.95 0c-.98 0-1.8-.9-1.8-2.01s.8-2.02 1.8-2.02c1.01 0 1.82.91 1.8 2.02 0 1.1-.79 2.01-1.8 2.01Z" />
      </svg>
    ),
  },
]

export default function Connexion() {
  const [enCours, setEnCours] = useState<Fournisseur | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function entrer(fournisseur: Fournisseur) {
    setErreur(null)
    setEnCours(fournisseur)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: fournisseur,
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    if (error) {
      setErreur("La connexion n'a pas abouti. Réessaie dans un instant.")
      setEnCours(null)
    }
  }

  return (
    <div className="ecran">
      <div style={{ textAlign: 'center', padding: '36px 0 30px' }}>
        {/* Le blason porte déjà le nom : pas de titre en double dessous. */}
        <img
          src={`${import.meta.env.BASE_URL}marque-560.png`}
          srcSet={
            `${import.meta.env.BASE_URL}marque-560.png 560w, ` +
            `${import.meta.env.BASE_URL}marque-1120.png 1120w`
          }
          sizes="(max-width: 540px) 84vw, 440px"
          alt="Le Cap"
          width={661}
          height={612}
          style={{
            width: 'min(84vw, 440px)',
            height: 'auto',
            filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.6))',
          }}
        />
      </div>

      {erreur && <div className="avis">{erreur}</div>}

      <div className="quetes">
        {FOURNISSEURS.map((f) => (
          <button
            key={f.cle}
            className="quete"
            onClick={() => entrer(f.cle)}
            disabled={enCours !== null}
            style={{
              justifyContent: 'center',
              padding: '16px',
              fontWeight: 600,
              borderColor: f.teinte,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {f.icone}
            <span style={{ marginLeft: 2 }}>
              {enCours === f.cle ? 'Un instant…' : `Continuer avec ${f.nom}`}
            </span>
          </button>
        ))}
      </div>

      <p className="faible" style={{ marginTop: 22, textAlign: 'center' }}>
        On ne récupère ni ton nom ni ta photo : tu choisis un pseudo à l'étape
        suivante. Ton binôme est la seule personne qui le verra.
      </p>
    </div>
  )
}

