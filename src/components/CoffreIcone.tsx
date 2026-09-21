// Un coffre dessiné, à quatre états. Les émojis rendaient différemment d'un
// téléphone à l'autre et juraient avec le laiton du reste — celui-ci est le
// même partout et prend les couleurs de la palette.

export type EtatCoffre = 'vide' | 'pret' | 'a_remettre' | 'remis'

const TEINTES: Record<EtatCoffre, { corps: string; bande: string; trait: string }> = {
  vide: { corps: '#0d3543', bande: '#17505f', trait: '#2b6273' },
  pret: { corps: '#5c4413', bande: '#a86018', trait: '#e9b44c' },
  a_remettre: { corps: '#7a5c15', bande: '#e9b44c', trait: '#f8d281' },
  remis: { corps: '#123f4d', bande: '#4a6a76', trait: '#7d9fa3' },
}

export function CoffreIcone({
  etat,
  taille = 38,
  /** Le couvercle s'ouvre, que le coffre soit remis ou non. Pour l'animation. */
  ouvertForce,
}: {
  etat: EtatCoffre
  taille?: number
  ouvertForce?: boolean
}) {
  const t = TEINTES[etat]
  const ouvert = ouvertForce ?? etat === 'remis'

  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 48 48"
      aria-hidden="true"
      style={
        etat === 'a_remettre'
          ? { filter: 'drop-shadow(0 0 7px rgba(233,180,76,0.75))' }
          : undefined
      }
    >
      {/* Le couvercle : basculé en arrière une fois le coffre ouvert. */}
      <g
        transform={ouvert ? 'rotate(-26 10 20)' : undefined}
        style={{ transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <path
          d="M9 20a15 15 0 0 1 30 0v3H9z"
          fill={t.corps}
          stroke={t.trait}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <rect x="9" y="20" width="30" height="4" rx="1" fill={t.bande} />
      </g>

      {/* La caisse. */}
      <rect
        x="9"
        y="24"
        width="30"
        height="16"
        rx="2.5"
        fill={t.corps}
        stroke={t.trait}
        strokeWidth="2.4"
      />
      <rect x="9" y="29" width="30" height="3.5" fill={t.bande} />

      {/* La serrure, seulement tant que le coffre est fermé. */}
      {!ouvert && (
        <>
          <rect
            x="21"
            y="26"
            width="6"
            height="8"
            rx="1.6"
            fill={t.bande}
            stroke={t.trait}
            strokeWidth="1.4"
          />
          <circle cx="24" cy="30" r="1.3" fill={t.corps} />
        </>
      )}

      {/* Ce qui dépasse quand il est ouvert. */}
      {ouvert && <circle cx="24" cy="27" r="3.2" fill="#e9b44c" opacity="0.75" />}
    </svg>
  )
}
