import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Journal } from '../components/Journal'
import { CoffreIcone, type EtatCoffre } from '../components/CoffreIcone'
import { Repartition } from '../components/Repartition'
import { avatarPour, levelFromXp, rankLabel } from '../lib/levels'
import type { Bonus, Day, Pact, Progress, Reward, Situation, Tier, TierEvent } from '../lib/types'

// Le poste de commandement : même grammaire que la scène du joueur, mais c'est
// LUI qu'on regarde. Pas de fête plein écran ici — la célébration appartient à
// celui qui avance ; elle, elle la déclenche.
//
// C'est le seul écran de l'application autorisé à lire la table rewards. Côté
// joueur, la même requête renverrait une liste vide : c'est la base qui le
// garantit, pas cet écran.

type Props = { pact: Pact; onQuitter: () => void }
type NomOnglet = 'valider' | 'coffres' | 'journal'

export default function Partenaire({ pact, onQuitter }: Props) {
  const [progres, setProgres] = useState<Progress | null>(null)
  const [bareme, setBareme] = useState<Situation[]>([])
  const [paliers, setPaliers] = useState<Tier[]>([])
  const [jours, setJours] = useState<Day[]>([])
  const [bonus, setBonus] = useState<Bonus[]>([])
  const [recompenses, setRecompenses] = useState<Reward[]>([])
  const [evenements, setEvenements] = useState<TierEvent[]>([])
  const [pseudoJoueur, setPseudoJoueur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [onglet, setOnglet] = useState<NomOnglet>('valider')
  const [vue, setVue] = useState<'valider' | 'pouvoir'>('valider')

  const charger = useCallback(async () => {
    const [p, s, t, j, r, b, ev, prof] = await Promise.all([
      supabase.rpc('progress', { p: pact.id }).single(),
      supabase.from('situation_scale').select('*').order('rank'),
      supabase.from('tiers').select('*').eq('pact_id', pact.id).order('level'),
      supabase.from('days').select('*').eq('pact_id', pact.id).order('day', { ascending: false }).limit(60),
      supabase.from('rewards').select('*').eq('pact_id', pact.id),
      supabase.from('bonuses').select('*').eq('pact_id', pact.id).order('created_at', { ascending: false }),
      supabase.from('tier_events').select('*').eq('pact_id', pact.id).order('tier_level'),
      supabase.from('profiles').select('pseudo').eq('id', pact.player_id ?? '').maybeSingle(),
    ])
    setProgres((p.data as Progress) ?? null)
    setBareme((s.data as Situation[]) ?? [])
    setPaliers((t.data as Tier[]) ?? [])
    setJours((j.data as Day[]) ?? [])
    setRecompenses((r.data as Reward[]) ?? [])
    setBonus((b.data as Bonus[]) ?? [])
    setEvenements((ev.data as TierEvent[]) ?? [])
    setPseudoJoueur((prof.data as { pseudo: string } | null)?.pseudo ?? null)
    setChargement(false)
  }, [pact.id, pact.player_id])

  useEffect(() => {
    void charger()
  }, [charger])

  if (chargement) return <div className="ecran doux">Un instant…</div>

  const aValider = jours.filter((d) => !d.validated_at)
  const enReserve = bonus.filter((b) => !b.revealed_at)
  const aRemettre = evenements.filter((e) => !e.delivered_at)
  const prochain = progres?.next_tier_level ?? null
  const prochainPret = prochain
    ? recompenses.some((c) => c.tier_level === prochain)
    : true

  return (
    <div className="jeu">
      <SceneBarre
        progres={progres}
        pseudoJoueur={pseudoJoueur}
        aValider={aValider.length}
        aRemettre={aRemettre.length}
        prochain={prochain}
        prochainPret={prochainPret}
        enReserve={enReserve.length}
        onReglages={onQuitter}
      />

      <div className="panneau">
        {onglet === 'valider' && (
          <div className="fenetre">
            <h2>Ton tour</h2>

            {/* Arbitrage et pouvoir partagent la même fenêtre : deux onglets
                internes plutôt que deux encadrés qui allongent l'écran. */}
            <div className="onglets-fenetre" role="tablist">
              <button
                className="onglet-fenetre"
                role="tab"
                aria-selected={vue === 'valider'}
                onClick={() => setVue('valider')}
              >
                À valider
                {aValider.length > 0 && (
                  <span className="compteur">{aValider.length}</span>
                )}
              </button>
              <button
                className="onglet-fenetre"
                role="tab"
                aria-selected={vue === 'pouvoir'}
                onClick={() => setVue('pouvoir')}
              >
                Ton pouvoir
                {enReserve.length > 0 && (
                  <span className="compteur">{enReserve.length}</span>
                )}
              </button>
            </div>

            {vue === 'valider' ? (
              aValider.length === 0 ? (
                <p className="faible" style={{ marginBottom: 0 }}>
                  Rien en attente. Tout ce qu’il a déclaré est arbitré.
                </p>
              ) : (
                aValider.map((j) => (
                  <Arbitrage
                    key={j.id}
                    jour={j}
                    bareme={bareme}
                    pact={pact}
                    onFait={charger}
                  />
                ))
              )
            ) : (
              <BonusSurprise pact={pact} enReserve={enReserve} onFait={charger} />
            )}
          </div>
        )}

        {onglet === 'coffres' && (
          <Coffres
            pact={pact}
            paliers={paliers}
            recompenses={recompenses}
            evenements={evenements}
            prochain={prochain}
            onFait={charger}
          />
        )}

        {onglet === 'journal' && (
          <Journal
            jours={jours}
            bonus={bonus}
            bareme={bareme}
            paliers={paliers}
            coffres={evenements}
            avecMots
          />
        )}
      </div>

      <nav className="onglets" role="tablist">
        <OngletBas
          actif={onglet === 'valider'}
          picto="⚖"
          nom="À valider"
          pastille={aValider.length > 0 ? String(aValider.length) : undefined}
          onClick={() => setOnglet('valider')}
        />
        <OngletBas
          actif={onglet === 'coffres'}
          picto="🎁"
          nom="Tes coffres"
          pastille={
            aRemettre.length > 0
              ? String(aRemettre.length)
              : paliers.length > recompenses.length
                ? String(paliers.length - recompenses.length)
                : undefined
          }
          onClick={() => setOnglet('coffres')}
        />
        <OngletBas
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

function OngletBas({
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

function SceneBarre({
  progres,
  pseudoJoueur,
  aValider,
  aRemettre,
  prochain,
  prochainPret,
  enReserve,
  onReglages,
}: {
  progres: Progress | null
  pseudoJoueur: string | null
  aValider: number
  aRemettre: number
  prochain: number | null
  prochainPret: boolean
  enReserve: number
  onReglages: () => void
}) {
  const xp = progres?.total ?? 0
  const niveau = levelFromXp(xp)
  const [sansAvatar, setSansAvatar] = useState(false)
  const portrait = sansAvatar
    ? `${import.meta.env.BASE_URL}logo-320.png`
    : avatarPour(niveau.level)
  const lui = pseudoJoueur ?? 'Il'

  // Ce que la boîte de dialogue lui dit, par ordre d'urgence.
  const message =
    aValider > 0 ? (
      <p>
        {lui} a déclaré{' '}
        <b>
          {aValider} journée{aValider > 1 ? 's' : ''}
        </b>
        . À toi d’arbitrer ce que ça valait.
      </p>
    ) : aRemettre > 0 ? (
      <p>
        Un coffre est tombé. <b>À toi de choisir le moment</b> — ce soir, ou dans
        trois jours.
      </p>
    ) : prochain && !prochainPret ? (
      <p>
        {lui} est niveau {niveau.level}. Le <b>coffre du niveau {prochain}</b>{' '}
        approche, et il est encore vide.
      </p>
    ) : (
      <p>
        Rien en attente. {lui} tient le cap
        {enReserve > 0 && (
          <>
            , et tu gardes <b>{enReserve} bonus</b> en réserve
          </>
        )}
        .
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
              <div className="nom">
                {pseudoJoueur ?? 'Ton binôme'} · {xp} XP
              </div>
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

function Arbitrage({
  jour,
  bareme,
  pact,
  onFait,
}: {
  jour: Day
  bareme: Situation[]
  pact: Pact
  onFait: () => void
}) {
  const proposees = jour.situations
    .map((k) => bareme.find((s) => s.key === k))
    .filter((s): s is Situation => Boolean(s))

  const [points, setPoints] = useState<Record<string, number>>(
    Object.fromEntries(proposees.map((s) => [s.key, s.points])),
  )
  const [occupe, setOccupe] = useState(false)

  const total = Object.values(points).reduce((a, b) => a + b, 0)

  async function valider() {
    setOccupe(true)
    const lignes = proposees
      .filter((s) => (points[s.key] ?? 0) > 0)
      .map((s) => ({
        pact_id: pact.id,
        day_id: jour.id,
        kind: 'situation' as const,
        points: points[s.key],
        label: s.label,
        revealed_at: new Date().toISOString(),
      }))
    if (lignes.length > 0) await supabase.from('bonuses').insert(lignes)
    await supabase
      .from('days')
      .update({ validated_at: new Date().toISOString() })
      .eq('id', jour.id)
    setOccupe(false)
    onFait()
  }

  return (
    <div className="bloc-jour">
      <div className="entete-jour">
        <b>
          {new Date(jour.day).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </b>
        <span className="faible">
          {jour.status === 'zero' ? 'Journée à zéro' : 'Journée avec'}
        </span>
      </div>

      {jour.note && <p className="jour-mot" style={{ marginLeft: 0 }}>« {jour.note} »</p>}

      {proposees.length === 0 ? (
        <p className="faible" style={{ margin: '12px 0' }}>
          Rien de particulier ce jour-là — il n’y a que le point de la journée.
        </p>
      ) : (
        <div style={{ margin: '14px 0 4px' }}>
          {proposees.map((s) => (
            <div key={s.key} className="medaille">
              <span className="gemme-mini" data-rarete={rarete(s.points)} />
              <span className="nom-quete">{s.label}</span>
              <div className="reglage">
                <button
                  onClick={() =>
                    setPoints((p) => ({ ...p, [s.key]: Math.max(0, (p[s.key] ?? 0) - 1) }))
                  }
                  disabled={(points[s.key] ?? 0) <= 0}
                  aria-label={`Retirer un point à ${s.label}`}
                >
                  −
                </button>
                <span className="valeur">+{points[s.key] ?? 0}</span>
                <button
                  onClick={() =>
                    setPoints((p) => ({ ...p, [s.key]: Math.min(5, (p[s.key] ?? 0) + 1) }))
                  }
                  disabled={(points[s.key] ?? 0) >= 5}
                  aria-label={`Ajouter un point à ${s.label}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="action-jeu" onClick={valider} disabled={occupe}>
        {total > 0 ? `Accorder +${total} XP` : 'Valider sans bonus'}
        <span className="sous">
          {proposees.length > 0
            ? 'Le barème propose, tu décides'
            : 'Rien à arbitrer ce jour-là'}
        </span>
      </button>
    </div>
  )
}

function rarete(points: number) {
  return points >= 5 ? 'epique' : points >= 3 ? 'rare' : 'commune'
}

/* ====================================================================== */

function BonusSurprise({
  pact,
  enReserve,
  onFait,
}: {
  pact: Pact
  enReserve: Bonus[]
  onFait: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [points, setPoints] = useState(2)
  const [mot, setMot] = useState('')
  const [toutDeSuite, setToutDeSuite] = useState(true)
  const [occupe, setOccupe] = useState(false)

  async function accorder() {
    setOccupe(true)
    await supabase.from('bonuses').insert({
      pact_id: pact.id,
      kind: 'surprise',
      points,
      label: 'Bonus surprise',
      message: mot.trim() || null,
      revealed_at: toutDeSuite ? new Date().toISOString() : null,
    })
    setOccupe(false)
    setOuvert(false)
    setMot('')
    onFait()
  }

  async function reveler(id: string) {
    setOccupe(true)
    await supabase
      .from('bonuses')
      .update({ revealed_at: new Date().toISOString() })
      .eq('id', id)
    setOccupe(false)
    onFait()
  }

  return (
    <div>
      {!ouvert ? (
        <>
          <p className="faible" style={{ marginTop: 0 }}>
            De +1 à +5 XP, sans prévenir, quand tu trouves qu’il a traversé
            quelque chose de difficile.
          </p>
          <button className="discret" onClick={() => setOuvert(true)}>
            Accorder un bonus surprise
          </button>
        </>
      ) : (
        <>
          <div className="choix-points">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-pressed={points === n}
                onClick={() => setPoints(n)}
              >
                +{n}
              </button>
            ))}
          </div>

          <textarea
            value={mot}
            onChange={(e) => setMot(e.target.value.slice(0, 500))}
            placeholder="Un mot, s’il le mérite. Il ne le lira qu’au moment où tu le décides."
          />

          <div className="onglets-fenetre" style={{ marginTop: 12 }}>
            <button
              className="onglet-fenetre"
              aria-selected={toutDeSuite}
              onClick={() => setToutDeSuite(true)}
            >
              Lui montrer
            </button>
            <button
              className="onglet-fenetre"
              aria-selected={!toutDeSuite}
              onClick={() => setToutDeSuite(false)}
            >
              Garder en réserve
            </button>
          </div>

          <button
            className="action-jeu"
            onClick={accorder}
            disabled={occupe}
            style={{ marginTop: 14 }}
          >
            Accorder +{points} XP
            <span className="sous">
              {toutDeSuite ? 'Il le verra tout de suite' : 'Invisible pour lui'}
            </span>
          </button>
          <button className="fantome" onClick={() => setOuvert(false)}>
            Annuler
          </button>
        </>
      )}

      {enReserve.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--bord)', paddingTop: 14 }}>
          <p className="faible" style={{ marginTop: 0 }}>
            En réserve, invisible{enReserve.length > 1 ? 's' : ''} pour lui :
          </p>
          {enReserve.map((b) => (
            <div key={b.id} className="medaille">
              <span className="gemme-mini" data-rarete={rarete(b.points)} />
              <span className="nom-quete">
                +{b.points} XP
                {b.message && (
                  <span className="faible" style={{ display: 'block', fontStyle: 'italic' }}>
                    « {b.message} »
                  </span>
                )}
              </span>
              <button className="discret" style={{ width: 'auto', margin: 0 }} onClick={() => reveler(b.id)}>
                Révéler
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ====================================================================== */

/**
 * Tout ce qui touche aux coffres, au même endroit : les préparer, voir lesquels
 * sont prêts, et remettre ceux qui sont tombés. Un coffre porte son état et son
 * action — il n'y a plus à chercher sur un autre onglet.
 */
function Coffres({
  pact,
  paliers,
  recompenses,
  evenements,
  prochain,
  onFait,
}: {
  pact: Pact
  paliers: Tier[]
  recompenses: Reward[]
  evenements: TierEvent[]
  prochain: number | null
  onFait: () => void
}) {
  const [choisi, setChoisi] = useState<number | null>(null)
  const [reglage, setReglage] = useState(false)

  if (reglage) {
    return (
      <Repartition
        pactId={pact.id}
        paliers={paliers}
        evenements={evenements}
        onRetour={() => setReglage(false)}
        onFait={() => {
          setReglage(false)
          onFait()
        }}
      />
    )
  }

  function etatDe(niveau: number): EtatCoffre {
    const ev = evenements.find((e) => e.tier_level === niveau)
    if (ev?.delivered_at) return 'remis'
    if (ev) return 'a_remettre'
    return recompenses.some((r) => r.tier_level === niveau) ? 'pret' : 'vide'
  }

  const palier = paliers.find((t) => t.level === choisi)
  if (palier) {
    return (
      <CoffreDetail
        pact={pact}
        palier={palier}
        etat={etatDe(palier.level)}
        prepare={recompenses.find((r) => r.tier_level === palier.level) ?? null}
        evenement={evenements.find((e) => e.tier_level === palier.level) ?? null}
        onRetour={() => setChoisi(null)}
        onFait={() => {
          setChoisi(null)
          onFait()
        }}
      />
    )
  }

  return (
    <div className="fenetre">
      <h2>Tes coffres</h2>
      <button
        className="fenetre-roue"
        onClick={() => setReglage(true)}
        aria-label="Régler la répartition des coffres"
        title="Régler la répartition"
      >
        ⚙
      </button>



      <div className="coffres-grille">
        {paliers.map((t) => {
          const etat = etatDe(t.level)
          const prepare = recompenses.find((r) => r.tier_level === t.level)
          return (
            <button
              key={t.level}
              className="coffre-carte"
              data-etat={etat}
              data-urgent={etat === 'vide' && t.level === prochain}
              onClick={() => setChoisi(t.level)}
            >
              <CoffreIcone etat={etat} />
              <span className="niveau">Niveau {t.level}</span>
              <span className="titre">{t.label}</span>
              <span className={etat === 'vide' ? 'a-preparer' : 'contenu'}>
                {etat === 'a_remettre'
                  ? 'À lui remettre'
                  : etat === 'remis'
                    ? 'Remis'
                    : prepare
                      ? prepare.content
                      : t.level === prochain
                        ? 'Le prochain — à préparer'
                        : 'À préparer'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ====================================================================== */

/**
 * Le détail d'un coffre. Selon son état, on le remplit ou on le remet.
 *
 * Au moment de la remise, le contenu est RECOPIÉ dans l'évènement : c'est le
 * seul chemin par lequel le joueur apprendra ce qu'il y avait dedans. La table
 * `rewards` ne s'ouvre pas à lui, même après coup.
 */
function CoffreDetail({
  pact,
  palier,
  etat,
  prepare,
  evenement,
  onRetour,
  onFait,
}: {
  pact: Pact
  palier: Tier
  etat: EtatCoffre
  prepare: Reward | null
  evenement: TierEvent | null
  onRetour: () => void
  onFait: () => void
}) {
  const [texte, setTexte] = useState(prepare?.content ?? '')
  const [garderSecret, setGarderSecret] = useState(false)
  const [occupe, setOccupe] = useState(false)

  async function sceller() {
    const contenu = texte.trim()
    if (!contenu) return
    setOccupe(true)
    await supabase.from('rewards').upsert(
      {
        pact_id: pact.id,
        tier_level: palier.level,
        content: contenu,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pact_id,tier_level' },
    )
    setOccupe(false)
    onFait()
  }

  async function remettre() {
    if (!evenement) return
    setOccupe(true)
    await supabase
      .from('tier_events')
      .update({
        delivered_at: new Date().toISOString(),
        contenu_revele: garderSecret ? null : (prepare?.content ?? null),
      })
      .eq('id', evenement.id)
    setOccupe(false)
    onFait()
  }

  return (
    <div className={etat === 'a_remettre' ? 'fenetre carte-or' : 'fenetre'}>
      <h2>Niveau {palier.level}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <CoffreIcone etat={etat} taille={54} />
        <div>
          <b style={{ color: 'var(--or)' }}>{palier.label}</b>
          <p className="faible" style={{ margin: 0 }}>
            {etat === 'a_remettre'
              ? 'Il l’a franchi. Il sait qu’un coffre est tombé, pas ce qu’il y a dedans.'
              : etat === 'remis'
                ? 'Déjà remis.'
                : 'Il connaît le niveau, jamais le contenu.'}
          </p>
        </div>
      </div>

      {etat === 'remis' ? (
        <p className="jour-mot" style={{ marginLeft: 0 }}>
          {evenement?.contenu_revele
            ? `« ${evenement.contenu_revele} »`
            : 'Tu as choisi de n’en rien écrire. C’est resté entre vous.'}
        </p>
      ) : etat === 'a_remettre' ? (
        <>
          {prepare ? (
            <p className="jour-mot" style={{ marginLeft: 0 }}>« {prepare.content} »</p>
          ) : (
            <p className="faible">
              Tu n&rsquo;avais rien préparé pour ce palier. Tu peux le remettre quand
              même — l&rsquo;application ne te jugera pas plus qu&rsquo;elle ne le
              juge, lui.
            </p>
          )}

          <button
            className="quete-jeu"
            data-cochee={garderSecret}
            onClick={() => setGarderSecret((v) => !v)}
            type="button"
            style={{ marginTop: 12 }}
          >
            <span className="gemme">{garderSecret ? '✓' : ''}</span>
            <span className="libelle">
              Ne rien écrire dans son journal — ça reste entre vous
            </span>
          </button>

          <button
            className="action-jeu"
            onClick={remettre}
            disabled={occupe}
            style={{ marginTop: 14 }}
          >
            Lui offrir
            <span className="sous">
              {garderSecret || !prepare
                ? 'Rien ne sera écrit dans son journal'
                : 'Son journal en gardera la trace'}
            </span>
          </button>
        </>
      ) : (
        <>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value.slice(0, 1000))}
            placeholder="Ce que tu lui prépares…"
            autoFocus
          />
          <button
            className="action-jeu"
            onClick={sceller}
            disabled={occupe || !texte.trim()}
            style={{ marginTop: 12 }}
          >
            Sceller le coffre
          </button>
        </>
      )}

      <button className="fantome" onClick={onRetour}>
        ← Tous les coffres
      </button>
    </div>
  )
}
