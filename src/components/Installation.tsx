import { useEffect, useState } from 'react'

// Comment poser Le Cap sur un écran d'accueil.
//
// Sur Chrome et Edge, le navigateur nous prévient qu'il sait installer : on
// garde l'évènement de côté et on propose un vrai bouton. Ailleurs — et surtout
// sur iPhone, où cette possibilité n'existe pas — on explique le geste.
//
// Ce n'est pas du confort : sur iPhone, les notifications web n'existent QUE si
// l'application a été ajoutée à l'écran d'accueil.

type EvenementInstallation = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Plateforme = 'ordinateur' | 'android' | 'apple'

function plateformeDetectee(): Plateforme {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'apple'
  // Un iPad récent se fait passer pour un Mac : le tactile le trahit.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'apple'
  if (/Android/i.test(ua)) return 'android'
  return 'ordinateur'
}

export function Installation() {
  const [invite, setInvite] = useState<EvenementInstallation | null>(null)
  const [plateforme, setPlateforme] = useState<Plateforme>(plateformeDetectee)
  const [installee, setInstallee] = useState(false)

  useEffect(() => {
    setInstallee(
      window.matchMedia('(display-mode: standalone)').matches ||
        // Safari sur iPhone ne connaît pas display-mode et a son propre drapeau.
        (navigator as { standalone?: boolean }).standalone === true,
    )

    const capter = (e: Event) => {
      e.preventDefault()
      setInvite(e as EvenementInstallation)
    }
    const posee = () => {
      setInstallee(true)
      setInvite(null)
    }
    window.addEventListener('beforeinstallprompt', capter)
    window.addEventListener('appinstalled', posee)
    return () => {
      window.removeEventListener('beforeinstallprompt', capter)
      window.removeEventListener('appinstalled', posee)
    }
  }, [])

  if (installee) {
    return (
      <div className="carte">
        <h2>Le Cap est installé</h2>
        <p className="faible" style={{ marginBottom: 0 }}>
          Tu le lances depuis ton écran d&rsquo;accueil, sans passer par le
          navigateur.
        </p>
      </div>
    )
  }

  return (
    <div className="carte">
      <h2>L&rsquo;installer sur ton écran d&rsquo;accueil</h2>
      <p className="faible">
        Le Cap devient une application à part entière : une icône, pas de barre
        d&rsquo;adresse, et il s&rsquo;ouvre même sans réseau.
      </p>

      {invite && (
        <button
          className="principal"
          onClick={async () => {
            await invite.prompt()
            await invite.userChoice
            setInvite(null)
          }}
          style={{ marginBottom: 14 }}
        >
          Installer maintenant
        </button>
      )}

      <div className="onglets-fenetre">
        {(['ordinateur', 'android', 'apple'] as Plateforme[]).map((p) => (
          <button
            key={p}
            className="onglet-fenetre"
            role="tab"
            aria-selected={plateforme === p}
            onClick={() => setPlateforme(p)}
          >
            {p === 'ordinateur' ? 'Ordinateur' : p === 'android' ? 'Android' : 'iPhone'}
          </button>
        ))}
      </div>

      {plateforme === 'ordinateur' && (
        <ol className="marche-a-suivre">
          <li>
            Dans Chrome ou Edge, repère l&rsquo;icône d&rsquo;installation à droite
            de la barre d&rsquo;adresse — un écran avec une flèche.
          </li>
          <li>
            Sans icône, ouvre le menu <b>⋮</b> puis <b>Installer Le Cap</b>.
          </li>
          <li>Firefox et Safari sur Mac ne savent pas installer : garde un onglet.</li>
        </ol>
      )}

      {plateforme === 'android' && (
        <ol className="marche-a-suivre">
          <li>
            Dans Chrome, ouvre le menu <b>⋮</b> en haut à droite.
          </li>
          <li>
            Choisis <b>Installer l&rsquo;application</b> — ou{' '}
            <b>Ajouter à l&rsquo;écran d&rsquo;accueil</b> selon la version.
          </li>
          <li>Confirme. L&rsquo;icône apparaît avec tes autres applications.</li>
        </ol>
      )}

      {plateforme === 'apple' && (
        <ol className="marche-a-suivre">
          <li>
            Ouvre cette page <b>dans Safari</b> — Chrome sur iPhone ne sait pas le
            faire.
          </li>
          <li>
            Touche le bouton <b>Partager</b>, le carré avec une flèche vers le
            haut, en bas de l&rsquo;écran.
          </li>
          <li>
            Fais défiler et choisis <b>Sur l&rsquo;écran d&rsquo;accueil</b>, puis{' '}
            <b>Ajouter</b>.
          </li>
          <li>
            <b>Ce geste n&rsquo;est pas optionnel si tu veux les rappels</b> : sur
            iPhone, une application web ne peut envoyer de notification que si
            elle a été ajoutée à l&rsquo;écran d&rsquo;accueil.
          </li>
        </ol>
      )}
    </div>
  )
}
