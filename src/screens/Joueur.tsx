import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Entete } from '../components/Entete'
import { Blason } from '../components/Blason'
import { Route } from '../components/Route'
import { gameDay } from '../lib/types'
import type { Bonus, Day, Pact, Progress, Situation, Tier, TierEvent } from '../lib/types'

// Cet écran ne demande JAMAIS la table rewards. Le prochain coffre s'affiche
// par son palier et un point d'interrogation, et rien d'autre ne descend.

type Props = { pact: Pact; onQuitter: () => void }

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

  const aujourdhui = gameDay(pact.day_rollover_hour)
  const jourDuJour = jours.find((j) => j.day === aujourdhui) ?? null

  const charger = useCallback(async () => {
    const [p, s, t, j, c, b] = await Promise.all([
      supabase.rpc('progress', { p: pact.id }).single(),
      supabase.from('situation_scale').select('*').order('rank'),
      supabase.from('tiers').select('*').eq('pact_id', pact.id).order('points'),
      supabase.from('days').select('*').eq('pact_id', pact.id).order('day', { ascending: false }).limit(30),
      supabase.from('tier_events').select('*').eq('pact_id', pact.id).order('tier_points'),
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

    // Un palier jamais fêté sur cet appareil : on lui fait sa fête.
    // La trace est locale — la perdre ne coûte qu'une fête en double.
    const dernier = evenements[evenements.length - 1]
    if (dernier) {
      try {
        const cle = `lecap.fete.${pact.id}`
        const vues = JSON.parse(localStorage.getItem(cle) ?? '[]') as number[]
        if (!vues.includes(dernier.tier_points)) {
          setFete(dernier)
          localStorage.setItem(cle, JSON.stringify([...vues, dernier.tier_points]))
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
  const enAttente = coffres.filter((c) => !c.delivered_at)
  const palierFete = paliers.find((t) => t.points === fete?.tier_points)

  return (
    <div className="ecran">
      {gain !== null && <div className="gain-flottant">+{gain} XP</div>}

      {fete && (
        <div className="fete" onClick={() => setFete(null)}>
          <div className="fete-carte">
            <div className="rayons" />
            <div className="fete-sceau">★</div>
            <h2>Palier {fete.tier_points} franchi</h2>
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

      <Entete
        actions={
          <button className="fantome" onClick={onQuitter}>
            Réglages
          </button>
        }
      />

      <Blason progres={progres} />

      <Route paliers={paliers} coffres={coffres} xp={xp} />

      {enAttente.length > 0 && (
        <div className="carte carte-or">
          <div className="coffre">
            <div className="sceau">{enAttente.length > 1 ? enAttente.length : '★'}</div>
            <div>
              <h2 style={{ marginBottom: 4 }}>
                {enAttente.length > 1
                  ? `${enAttente.length} surprises t’attendent`
                  : 'Une surprise t’attend'}
              </h2>
              <p className="faible" style={{ margin: 0 }}>
                Palier{enAttente.length > 1 ? 's' : ''}{' '}
                {enAttente.map((c) => c.tier_points).join(', ')} franchi
                {enAttente.length > 1 ? 's' : ''}. C’est ton binôme qui décide quand
                et comment.
              </p>
            </div>
          </div>
        </div>
      )}

      {jourDuJour ? (
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
      )}

      <Historique jours={jours} bonus={bonus} paliers={paliers} coffres={coffres} />
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
    <div className="carte">
      <h2>Aujourd’hui</h2>
      {erreur && <div className="avis">{erreur}</div>}

      <p className="faible" style={{ marginBottom: 14 }}>
        Tu as traversé quelque chose ? Coche la quête. C’est ton binôme qui décide
        de ce que ça vaut.
      </p>

      <div className="quetes">
        {bareme.map((s) => {
          const active = cochees.includes(s.key)
          return (
            <button
              key={s.key}
              className="quete-jeu"
              data-cochee={active}
              onClick={() => basculer(s.key)}
              type="button"
            >
              <span className="gemme" data-rarete={rarete(s.points)}>
                {active ? '✓' : ''}
              </span>
              <span className="libelle">{s.label}</span>
              <span className="gain-plaque">+{s.points}</span>
            </button>
          )
        })}
      </div>

      <div className="champ" style={{ marginTop: 16 }}>
        <label htmlFor="mot">Un mot, si tu veux</label>
        <textarea
          id="mot"
          value={mot}
          onChange={(e) => setMot(e.target.value.slice(0, 500))}
          placeholder="Deux lignes sur ta journée. Jamais obligatoire."
        />
      </div>

      <button className="action-jeu" onClick={() => declarer('zero')} disabled={occupe}>
        Journée à zéro
        <span className="sous">
          +1 XP{enJeu > 0 && ` · ${enJeu} XP de quêtes à arbitrer`}
        </span>
      </button>

      <button className="discret" onClick={() => declarer('ecart')} disabled={occupe}>
        J’ai bu aujourd’hui
      </button>
      <p className="faible" style={{ marginTop: 10, marginBottom: 0 }}>
        Un écart ne retire aucun XP. La série repart, le reste est acquis.
      </p>
    </div>
  )
}

/* ====================================================================== */

function JourDeclare({ jour, bareme }: { jour: Day; bareme: Situation[] }) {
  const quetes = jour.situations
    .map((k) => bareme.find((s) => s.key === k))
    .filter((s): s is Situation => Boolean(s))

  return (
    <div className="carte">
      <h2>{jour.status === 'zero' ? 'Journée à zéro — dans la poche' : 'Journée enregistrée'}</h2>
      {jour.status === 'zero' ? (
        <p className="faible" style={{ marginBottom: quetes.length ? 12 : 0 }}>
          {jour.validated_at
            ? 'Ton binôme a arbitré tes quêtes.'
            : 'Tes quêtes attendent l’arbitrage de ton binôme.'}
        </p>
      ) : (
        <p className="doux" style={{ marginBottom: 0 }}>
          C’est noté, sans commentaire. On se retrouve demain — l’XP déjà gagné ne
          bouge pas d’un point.
        </p>
      )}
      {quetes.length > 0 && (
        <div className="quetes">
          {quetes.map((s) => (
            <div key={s.key} className="quete-jeu" data-cochee="true">
              <span className="gemme" data-rarete={rarete(s.points)}>
                ✓
              </span>
              <span className="libelle">{s.label}</span>
              <span className="gain-plaque">+{s.points}</span>
            </div>
          ))}
        </div>
      )}
      {jour.note && (
        <p className="faible" style={{ marginTop: 12, marginBottom: 0, fontStyle: 'italic' }}>
          « {jour.note} »
        </p>
      )}
    </div>
  )
}

/* ====================================================================== */

function Historique({
  jours,
  bonus,
  paliers,
  coffres,
}: {
  jours: Day[]
  bonus: Bonus[]
  paliers: Tier[]
  coffres: TierEvent[]
}) {
  if (jours.length === 0) return null

  return (
    <div className="carte">
      <h2>Le journal de bord</h2>
      <div className="quetes">
        {jours.map((j) => {
          const gains = bonus.filter((b) => b.day_id === j.id)
          const total = gains.reduce((n, b) => n + b.points, 0) + (j.status === 'zero' ? 1 : 0)
          const franchi = coffres.find((c) => c.reached_at.slice(0, 10) === j.day)
          const palier = paliers.find((p) => p.points === franchi?.tier_points)
          return (
            <div key={j.id} className="quete-jeu">
              <span
                className="gemme"
                data-rarete={j.status === 'zero' ? 'commune' : undefined}
                style={j.status === 'zero' ? undefined : { background: 'var(--ardoise)' }}
              >
                {j.status === 'zero' ? '✓' : '·'}
              </span>
              <span className="libelle">
                {new Date(j.day).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {palier && (
                  <span style={{ color: 'var(--or)' }}> · coffre {palier.points} ouvert</span>
                )}
              </span>
              <span className="gain-plaque">{total > 0 ? `+${total}` : '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
