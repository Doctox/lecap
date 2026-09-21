import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Route } from '../components/Route'
import { Journal } from '../components/Journal'
import { avatarPour, levelFromXp, rankLabel, xpForLevel } from '../lib/levels'
import { CoffreIcone } from '../components/CoffreIcone'
import { gameDay } from '../lib/types'
import type { Bonus, Day, Pact, Progress, Situation, Tier, TierEvent } from '../lib/types'

// L'écran du joueur, monté comme une scène de jeu : le décor et le personnage
// en haut, une boîte de dialogue qui lui parle, puis un panneau par onglet.
//
// Cet écran ne demande JAMAIS la table rewards. Un coffre verrouillé n'affiche
// que son niveau et un point d'interrogation.

type Props = { pact: Pact; onQuitter: () => void }
type NomOnglet = 'jour' | 'route' | 'journal'

export default function Joueur({ pact, onQuitter }: Props) {
  const [progres, setProgres] = useState<Progress | null>(null)
  const [bareme, setBareme] = useState<Situation[]>([])
  const [paliers, setPaliers] = useState<Tier[]>([])
  const [jours, setJours] = useState<Day[]>([])
  const [coffres, setCoffres] = useState<TierEvent[]>([])
  const [bonus, setBonus] = useState<Bonus[]>([])
  const [chargement, setChargement] = useState(true)
  const [gain, setGain] = useState<number | null>(null)
  const [fete, setFete] = useState<TierEvent | null>(null)
  const [onglet, setOnglet] = useState<NomOnglet>('jour')
  const [coffreOuvert, setCoffreOuvert] = useState<number | null>(null)

  const aujourdhui = gameDay(pact.day_rollover_hour)
  const jourDuJour = jours.find((j) => j.day === aujourdhui) ?? null

  const charger = useCallback(async () => {
    const [p, s, t, j, c, b] = await Promise.all([
      supabase.rpc('progress', { p: pact.id }).single(),
      supabase.from('situation_scale').select('*').order('rank'),
      supabase.from('tiers').select('*').eq('pact_id', pact.id).order('level'),
      supabase.from('days').select('*').eq('pact_id', pact.id).order('day', { ascending: false }).limit(60),
      supabase.from('tier_events').select('*').eq('pact_id', pact.id).order('tier_level'),
      supabase.from('bonuses').select('*').eq('pact_id', pact.id).order('created_at', { ascending: false }),
    ])
    const evenements = (c.data as TierEvent[]) ?? []
    setProgres((p.data as Progress) ?? null)
    setBareme((s.data as Situation[]) ?? [])
    setPaliers((t.data as Tier[]) ?? [])
    setJours((j.data as Day[]) ?? [])
    setCoffres(evenements)
    setBonus((b.data as Bonus[]) ?? [])
    setChargement(false)

    // Un coffre jamais fêté sur cet appareil : on lui fait sa fête. La trace
    // est locale — la perdre ne coûte qu'une fête en double.
    const dernier = evenements[evenements.length - 1]
    if (dernier) {
      try {
        const cle = `lecap.fete.${pact.id}`
        const vues = JSON.parse(localStorage.getItem(cle) ?? '[]') as number[]
        if (!vues.includes(dernier.tier_level)) {
          setFete(dernier)
          localStorage.setItem(cle, JSON.stringify([...vues, dernier.tier_level]))
        }
      } catch {
        /* navigation privée, stockage bloqué : tant pis pour la mémoire */
      }
    }
  }, [pact.id])

  useEffect(() => {
    void charger()
  }, [charger])

  if (chargement) return <div className="ecran doux">Un instant…</div>

  const xp = progres?.total ?? 0
  const niv = levelFromXp(xp)
  const enAttente = coffres.filter((c) => !c.delivered_at)
  const palierFete = paliers.find((t) => t.level === fete?.tier_level)

  return (
    <div className="jeu">
      {gain !== null && <div className="gain-flottant">+{gain} XP</div>}

      {fete && (
        <div className="fete" onClick={() => setFete(null)}>
          <div className="fete-carte">
            <div className="rayons" />
            <div className="fete-sceau">★</div>
            <h2>Coffre du niveau {fete.tier_level}</h2>
            <p className="doux">
              {palierFete?.label ?? 'Un coffre s’ouvre'} — une surprise t’attend.
              C’est ton binôme qui choisit le moment.
            </p>
            <button className="action-jeu" onClick={() => setFete(null)}>
              Bien joué
            </button>
          </div>
        </div>
      )}

      <Scene
        niveau={niv}
        xp={xp}
        progres={progres}
        jourDuJour={jourDuJour}
        enAttente={enAttente.length}
        onReglages={onQuitter}
      />

      <div className="panneau">
        {onglet === 'jour' &&
          (jourDuJour ? (
            <JourDeclare jour={jourDuJour} bareme={bareme} />
          ) : (
            <Declarer
              pact={pact}
              jour={aujourdhui}
              bareme={bareme}
              onFait={async (points) => {
                setGain(points)
                window.setTimeout(() => setGain(null), 1500)
                await charger()
              }}
            />
          ))}

        {onglet === 'route' && (
          <>
            <Route
              paliers={paliers}
              coffres={coffres}
              niveau={progres?.level ?? 1}
              choisi={coffreOuvert}
              onChoisir={setCoffreOuvert}
            />
            {coffreOuvert !== null && (
              <DetailCoffre
                palier={paliers.find((t) => t.level === coffreOuvert)}
                evenement={coffres.find((c) => c.tier_level === coffreOuvert)}
                xp={xp}
              />
            )}
          </>
        )}

        {onglet === 'journal' && (
          <Journal
            jours={jours}
            bonus={bonus}
            bareme={bareme}
            paliers={paliers}
            coffres={coffres}
          />
        )}
      </div>

      <nav className="onglets" role="tablist">
        <Onglet
          actif={onglet === 'jour'}
          picto="⚓"
          nom="Aujourd’hui"
          pastille={jourDuJour ? undefined : '!'}
          onClick={() => setOnglet('jour')}
        />
        <Onglet
          actif={onglet === 'route'}
          picto="🧭"
          nom="La route"
          pastille={enAttente.length > 0 ? String(enAttente.length) : undefined}
          onClick={() => setOnglet('route')}
        />
        <Onglet
          actif={onglet === 'journal'}
          picto="📖"
          nom="Journal"
          onClick={() => setOnglet('journal')}
        />
      </nav>
    </div>
  )
}

/* ====================================================================== */

function Onglet({
  actif,
  picto,
  nom,
  pastille,
  onClick,
}: {
  actif: boolean
  picto: string
  nom: string
  pastille?: string
  onClick: () => void
}) {
  return (
    <button className="onglet" role="tab" aria-selected={actif} onClick={onClick}>
      <span className="pictogramme" aria-hidden="true">
        {picto}
      </span>
      {nom}
      {pastille && <span className="pastille">{pastille}</span>}
    </button>
  )
}

/* ====================================================================== */

function Scene({
  niveau,
  xp,
  progres,
  jourDuJour,
  enAttente,
  onReglages,
}: {
  niveau: ReturnType<typeof levelFromXp>
  xp: number
  progres: Progress | null
  jourDuJour: Day | null
  enAttente: number
  onReglages: () => void
}) {
  const [sansAvatar, setSansAvatar] = useState(false)
  const portrait = sansAvatar
    ? `${import.meta.env.BASE_URL}logo-320.png`
    : avatarPour(niveau.level)

  // Ce que dit la boîte de dialogue, par ordre d'importance.
  const message =
    enAttente > 0 ? (
      <p>
        Un coffre t’attend. <b>Ton binôme choisit le moment</b> — ça peut être ce
        soir, ça peut être dans trois jours.
      </p>
    ) : !jourDuJour ? (
      <p>
        Alors, cette journée ? <b>Déclare-la</b> et empoche ton XP. Si tu as
        traversé quelque chose, coche la quête.
      </p>
    ) : jourDuJour.status === 'zero' ? (
      <p>
        Journée à zéro, dans la poche. Encore <b>{niveau.xpToNext} XP</b> et tu
        passes niveau {niveau.level + 1}.
      </p>
    ) : (
      <p>
        C’est noté, sans commentaire. <b>L’XP déjà gagné ne bouge pas</b> — on se
        retrouve demain.
      </p>
    )

  return (
    <div className="scene">
      <div className="scene-haut">
        <div className="portrait-scene">
          <img key={portrait} src={portrait} alt="" onError={() => setSansAvatar(true)} />
          <span className="niveau-plaque">NIV. {niveau.level}</span>
        </div>

        <div className="ardoise">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rang-texte">{rankLabel(niveau)}</div>
              <div className="nom">{xp} XP</div>
            </div>
            <button
              className="fantome"
              onClick={onReglages}
              aria-label="Réglages"
              style={{ padding: '2px 6px', fontSize: '1.05rem' }}
            >
              ⚙
            </button>
          </div>

          <div className="ligne-xp">
            <span className="etiquette">XP</span>
            <div className="jauge-hud">
              <i style={{ width: `${Math.round(niveau.ratio * 100)}%` }} />
            </div>
          </div>

          <p className="compte">
            <b>{progres?.current_streak ?? 0}</b> jours d’affilée · record{' '}
            <b>{progres?.best_streak ?? 0}</b> · <b>{progres?.zero_days ?? 0}</b>{' '}
            journées à zéro
          </p>
        </div>
      </div>

      <div className="dialogue">{message}</div>
    </div>
  )
}

/* ====================================================================== */

function rarete(points: number) {
  return points >= 5 ? 'epique' : points >= 3 ? 'rare' : 'commune'
}

function Declarer({
  pact,
  jour,
  bareme,
  onFait,
}: {
  pact: Pact
  jour: string
  bareme: Situation[]
  onFait: (points: number) => void
}) {
  const [cochees, setCochees] = useState<string[]>([])
  const [mot, setMot] = useState('')
  const [vue, setVue] = useState<'quetes' | 'mot'>('quetes')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const enJeu = bareme
    .filter((s) => cochees.includes(s.key))
    .reduce((n, s) => n + s.points, 0)

  function basculer(key: string) {
    setCochees((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))
  }

  async function declarer(status: 'zero' | 'ecart') {
    setOccupe(true)
    setErreur(null)
    const { error } = await supabase.from('days').insert({
      pact_id: pact.id,
      day: jour,
      status,
      situations: status === 'zero' ? cochees : [],
      note: mot.trim() || null,
    })
    setOccupe(false)
    if (error) return setErreur("La déclaration n'est pas passée. Réessaie.")
    onFait(status === 'zero' ? 1 : 0)
  }

  return (
    <>
      <div className="fenetre">
        <h2>Ta journée</h2>
        {erreur && <div className="avis">{erreur}</div>}

        {/* Quêtes et mot partagent la même fenêtre : deux onglets internes
            plutôt que deux encadrés qui allongent l'écran. */}
        <div className="onglets-fenetre" role="tablist">
          <button
            className="onglet-fenetre"
            role="tab"
            aria-selected={vue === 'quetes'}
            onClick={() => setVue('quetes')}
          >
            Tes quêtes
            {cochees.length > 0 && <span className="compteur">{cochees.length}</span>}
          </button>
          <button
            className="onglet-fenetre"
            role="tab"
            aria-selected={vue === 'mot'}
            onClick={() => setVue('mot')}
          >
            Ton mot
            {mot.trim().length > 0 && <span className="compteur">•</span>}
          </button>
        </div>

        {vue === 'quetes' ? (
          <>
            <div className="menu-quetes">
              {bareme.map((s) => {
                const active = cochees.includes(s.key)
                return (
                  <button
                    key={s.key}
                    className="case-quete"
                    data-cochee={active}
                    onClick={() => basculer(s.key)}
                    type="button"
                  >
                    <span className="haut">
                      <span className="gemme-mini" data-rarete={rarete(s.points)} />
                      <span className="val">+{s.points}</span>
                    </span>
                    <span>{s.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="faible" style={{ margin: '10px 0 0' }}>
              Tu coches ce que tu as traversé. C’est ton binôme qui arbitre ce que
              ça vaut — tu ne choisis pas tes points toi-même.
            </p>
          </>
        ) : (
          <>
            <textarea
              value={mot}
              onChange={(e) => setMot(e.target.value.slice(0, 500))}
              placeholder="Deux lignes sur ta journée. Jamais obligatoire."
              autoFocus
            />
            <p className="faible" style={{ margin: '4px 0 0' }}>
              Lui seul le lira, et seulement s’il existe. {500 - mot.length} signes
              restants.
            </p>
          </>
        )}
      </div>

      <div className="manette">
        <button
          className="bouton-rond exit"
          onClick={() => declarer('ecart')}
          disabled={occupe}
          aria-label="Journée avec"
        >
          EXIT
          <span className="sous-rond">ça arrive</span>
        </button>

        <button
          className="bouton-rond cap"
          onClick={() => declarer('zero')}
          disabled={occupe}
          aria-label="Journée à zéro"
        >
          CAP
          <span className="sous-rond">
            +1 XP{enJeu > 0 && ` · +${enJeu} à arbitrer`}
          </span>
        </button>
      </div>

      <p className="faible apres-manette">
        <b>CAP</b>, c'est la journée tenue. <b>EXIT</b>, c'est celle où ça n'a pas
        tenu — aucun XP ne se retire, la série repart, le reste est acquis.
      </p>
    </>
  )
}

/* ====================================================================== */

function JourDeclare({ jour, bareme }: { jour: Day; bareme: Situation[] }) {
  const quetes = jour.situations
    .map((k) => bareme.find((s) => s.key === k))
    .filter((s): s is Situation => Boolean(s))

  return (
    <div className="fenetre">
      <h2>{jour.status === 'zero' ? 'Journée bouclée' : 'Journée enregistrée'}</h2>

      {jour.status === 'zero' ? (
        <p className="doux" style={{ marginBottom: quetes.length ? 12 : 0 }}>
          {jour.validated_at
            ? 'Ton binôme a arbitré tes quêtes.'
            : quetes.length > 0
              ? 'Tes quêtes attendent son arbitrage.'
              : 'Rien à arbitrer, l’XP est acquis.'}
        </p>
      ) : (
        <p className="doux" style={{ marginBottom: 0 }}>
          C’est noté, sans commentaire. On se retrouve demain.
        </p>
      )}

      {quetes.length > 0 && (
        <div className="menu-quetes">
          {quetes.map((s) => (
            <div key={s.key} className="case-quete" data-cochee="true">
              <span className="haut">
                <span className="gemme-mini" data-rarete={rarete(s.points)} />
                <span className="val">+{s.points}</span>
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {jour.note && (
        <p className="jour-mot" style={{ marginLeft: 0 }}>
          « {jour.note} »
        </p>
      )}
    </div>
  )
}

/* ====================================================================== */

/**
 * Ce qu'un coffre a à dire, selon où il en est. Verrouillé, il ne dit que la
 * distance — jamais son contenu, qui n'est de toute façon pas descendu jusqu'ici.
 */
function DetailCoffre({
  palier,
  evenement,
  xp,
}: {
  palier?: Tier
  evenement?: TierEvent
  xp: number
}) {
  const remis = Boolean(evenement?.delivered_at)

  // Un coffre déjà offert s'ouvre à l'écran quand on le touche : il part fermé,
  // le couvercle bascule, et un éclat passe. Voir ce qu'on a reçu mérite mieux
  // qu'un texte qui apparaît.
  const [ouvre, setOuvre] = useState(false)
  useEffect(() => {
    if (!remis) return
    setOuvre(false)
    const t = window.setTimeout(() => setOuvre(true), 120)
    return () => window.clearTimeout(t)
  }, [remis, palier?.level])

  if (!palier) return null

  const manque = Math.max(0, xpForLevel(palier.level) - xp)
  const etat = remis ? 'remis' : evenement ? 'a_remettre' : 'vide'

  return (
    <div className={remis ? 'fenetre' : evenement ? 'fenetre carte-or' : 'fenetre'}>
      <h2>Niveau {palier.level}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="coffre-ouverture" data-ouvre={remis && ouvre}>
          <CoffreIcone etat={etat} taille={54} ouvertForce={remis ? ouvre : undefined} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ color: 'var(--or)' }}>{palier.label}</b>

          {remis ? (
            <p className="jour-mot" style={{ marginLeft: 0, marginTop: 6 }}>
              {evenement?.contenu_revele
                ? `« ${evenement.contenu_revele} »`
                : 'Ton binôme a préféré que ça reste entre vous.'}
            </p>
          ) : evenement ? (
            <p className="doux" style={{ margin: '6px 0 0' }}>
              Franchi. Une surprise t’attend — c’est ton binôme qui choisit le
              moment.
            </p>
          ) : (
            <p className="faible" style={{ margin: '6px 0 0' }}>
              Encore <b style={{ color: 'var(--or)' }}>{manque} XP</b>. Ce qu’il y a
              dedans, tu ne le sauras qu’en l’ouvrant.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
