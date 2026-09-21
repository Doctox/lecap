import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Entete } from '../components/Entete'

// Quatre étapes avant de jouer : un pseudo, l'accord explicite, un rôle, et le
// code de duo. Chacun passe par son propre accord, sur son propre appareil.
// Le brief est net là-dessus : « c'est un jeu à deux, pas un outil de
// surveillance », et l'application doit le dire à la première ouverture.

type Props = {
  userId: string
  pseudoExistant: string | null
  onPret: () => void
  /** Duo créé mais binôme pas encore arrivé : on affiche le code en attendant. */
  enAttente: string | null
}

export default function Bienvenue({ userId, pseudoExistant, onPret, enAttente }: Props) {
  const [pseudo, setPseudo] = useState(pseudoExistant ?? '')
  const [etape, setEtape] = useState<'pseudo' | 'accord' | 'role' | 'code' | 'partage'>(
    !pseudoExistant ? 'pseudo' : enAttente ? 'partage' : 'accord',
  )
  const [accepte, setAccepte] = useState(false)
  const [infoRoles, setInfoRoles] = useState(false)
  const [codePartage, setCodePartage] = useState(enAttente ?? '')
  const [codeSaisi, setCodeSaisi] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrerPseudo() {
    const propre = pseudo.trim()
    // Deux caractères au minimum, comme la contrainte en base : mieux vaut un
    // bouton inactif qu'une erreur renvoyée par le serveur.
    if (propre.length < 2) return
    setOccupe(true)
    setErreur(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, pseudo: propre })
    setOccupe(false)

    if (error) {
      // 23503 : la clé étrangère vers auth.users a sauté. Le jeton du navigateur
      // est encore valide, mais le compte qu'il désigne n'existe plus — il a été
      // supprimé côté serveur. Rester connecté ne mène nulle part : on sort.
      if (error.code === '23503') {
        setErreur('Ta session a expiré. On te reconnecte…')
        // scope 'local' : on jette le jeton SANS appeler le serveur. Une
        // déconnexion normale demande au serveur de révoquer la session — mais
        // ici le compte n'existe plus, donc cet appel échouerait et laisserait
        // la personne bloquée avec son jeton mort.
        await supabase.auth.signOut({ scope: 'local' })
        return
      }
      return setErreur("Le pseudo n'a pas pu être enregistré.")
    }
    setEtape('accord')
  }

  async function ouvrirLaPartie() {
    setOccupe(true)
    setErreur(null)
    const { data, error } = await supabase.rpc('create_pact')
    setOccupe(false)
    if (error || !data) return setErreur("La partie n'a pas pu être ouverte.")
    setCodePartage((data as { join_code: string }).join_code)
    setEtape('partage')
  }

  async function rejoindre() {
    const propre = codeSaisi.trim().toUpperCase()
    if (propre.length !== 6) return setErreur('Un code fait six caractères.')
    setOccupe(true)
    setErreur(null)
    const { error } = await supabase.rpc('join_pact', { code: propre })
    setOccupe(false)
    if (error) {
      return setErreur(
        error.message.includes('complet')
          ? 'Ce duo a déjà quelqu’un à la barre.'
          : error.message.includes('le tien')
            ? 'C’est ton propre code — transmets-le à ton binôme.'
            : 'Ce code ne correspond à aucune partie. Vérifie les six caractères.',
      )
    }
    onPret()
  }

  return (
    <div className="ecran">
      <Entete
        actions={
          <button className="fantome" onClick={() => supabase.auth.signOut()}>
            Changer de compte
          </button>
        }
      />

      {erreur && <div className="avis">{erreur}</div>}

      {etape === 'pseudo' && (
        <div className="carte">
          <h2>Comment on t'appelle ?</h2>
          <p className="doux">
            Un pseudo suffit. Ton binôme est la seule personne qui le verra —
            il n'y a ni annuaire, ni classement, ni profil public.
          </p>
          <p className="faible">De deux à vingt-quatre caractères.</p>
          <div className="champ">
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value.slice(0, 24))}
              placeholder="Ton pseudo"
              maxLength={24}
              autoFocus
            />
          </div>
          <button
            className="principal"
            onClick={enregistrerPseudo}
            disabled={occupe || pseudo.trim().length < 2}
          >
            Continuer
          </button>
        </div>
      )}

      {/* Le consentement doit être un geste, pas une case déjà cochée au fond
          d'un écran. Il porte sur une donnée de santé : sans lui, rien ne se
          crée et rien ne se conserve. */}
      {etape === 'accord' && (
        <>
          <div className="carte">
            <h2>Le Cap se joue à deux</h2>
            <p className="doux">
              L'un avance et marque l'XP. L'autre compte les points, arbitre les
              quêtes et prépare les coffres — dont le contenu restera secret
              jusqu'au bout.
            </p>
            <p className="faible" style={{ marginBottom: 0 }}>
              Personne ne surveille personne : c'est un jeu, pas un contrôle.
              L'un et l'autre peuvent tout effacer à n'importe quel moment.
            </p>
          </div>

          <div className="carte carte-or">
            <h2>Avant de commencer</h2>
            <p className="doux">
              Ce que tu déclares ici — une journée avec ou sans ton addiction —
              est une information sur ta santé. La loi demande que tu l'acceptes
              explicitement, et c'est normal.
            </p>
            <p className="doux">Concrètement, en entrant dans un duo :</p>
            <ul className="doux" style={{ margin: '0 0 14px', paddingLeft: 20 }}>
              <li>
                <strong>ton binôme verra tes journées</strong>, les situations que
                tu coches et les mots que tu écris ;
              </li>
              <li>personne d'autre n'y aura accès, jamais ;</li>
              <li>
                l'un ou l'autre peut tout effacer d'un geste, des deux côtés, sans
                copie.
              </li>
            </ul>

            <button
              className="quete"
              data-cochee={accepte}
              onClick={() => setAccepte((v) => !v)}
              type="button"
            >
              <span className="case">{accepte ? '✓' : ''}</span>
              <span>J'ai lu et j'accepte que ces informations soient conservées.</span>
            </button>

            <p className="faible" style={{ margin: '12px 0 14px' }}>
              Tu peux revenir sur cet accord quand tu veux : le retirer, c'est tout
              effacer.{' '}
              <a
                href={`${import.meta.env.BASE_URL}legal/confidentialite.html`}
                target="_blank"
                rel="noreferrer"
              >
                Lire la page Confidentialité
              </a>
              .
            </p>

            <button
              className="principal"
              onClick={() => setEtape('role')}
              disabled={!accepte}
            >
              Continuer
            </button>
          </div>
        </>
      )}

      {etape === 'role' && (
        <div className="carte">
          <div className="avec-info">
            <h2>Tu tiens quel rôle ?</h2>
            <button
              className="info"
              type="button"
              aria-expanded={infoRoles}
              aria-label="Que font les deux rôles ?"
              onClick={() => setInfoRoles((v) => !v)}
              onMouseEnter={() => setInfoRoles(true)}
            >
              i
            </button>
          </div>

          {infoRoles && (
            <div className="explication">
              <p>
                <b>Garder le cap</b> — tu déclares tes journées, tu marques l'XP et
                tu montes les niveaux. Tu vois ta progression et les paliers qui
                approchent, jamais ce que ton binôme a mis dans les coffres.
              </p>
              <p>
                <b>Tenir la barre</b> — tu arbitres les quêtes de l'autre, tu
                accordes les bonus, et tu remplis les coffres de chaque palier. Ce
                que tu y écris, son compte n'a pas le droit de le lire.
              </p>
            </div>
          )}

          <button
            className="principal"
            onClick={ouvrirLaPartie}
            disabled={occupe}
            style={{ marginBottom: 10 }}
          >
            Je garde le cap et j'en suis cap
          </button>
          <button
            className="discret"
            onClick={() => setEtape('code')}
            disabled={occupe}
          >
            Je tiens la barre et j'en suis cap
          </button>
          <p className="faible" style={{ margin: '12px 0 0' }}>
            Celui qui garde le cap ouvre la partie et reçoit un code. Celui qui
            tient la barre le saisit pour le rejoindre.
          </p>
        </div>
      )}

      {etape === 'code' && (
        <div className="carte">
          <h2>Prendre la barre</h2>
          <p className="doux">
            Six caractères, transmis par la personne qui garde le cap. C'est elle
            qui ouvre la partie ; toi, tu la rejoins.
          </p>
          <div className="champ">
            <input
              className="code"
              value={codeSaisi}
              onChange={(e) => setCodeSaisi(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="······"
              maxLength={6}
              autoFocus
            />
          </div>
          <button className="principal" onClick={rejoindre} disabled={occupe}>
            Prendre la barre
          </button>
          <button className="fantome" onClick={() => setEtape('accord')}>
            ← Retour
          </button>
        </div>
      )}

      {etape === 'partage' && (
        <div className="carte carte-or">
          <h2>Ta partie est ouverte</h2>
          <p className="doux">
            Transmets ce code à la personne qui tiendra la barre. Elle se
            connecte, la saisit, et vous êtes deux.
          </p>
          <div className="code" style={{ padding: '18px 0', color: 'var(--or)' }}>
            {codePartage}
          </div>
          <button className="principal" onClick={onPret}>
            {enAttente ? 'Il est arrivé ?' : "C'est parti"}
          </button>
          {enAttente && (
            <p className="faible" style={{ marginTop: 10, marginBottom: 0 }}>
              Tant que la deuxième personne n'a pas rejoint, la partie attend.
              Rien ne se perd.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
