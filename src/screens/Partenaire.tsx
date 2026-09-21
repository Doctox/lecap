import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Entete } from '../components/Entete'
import { Blason } from '../components/Blason'
import { Journal } from '../components/Journal'
import type { Bonus, Day, Pact, Progress, Reward, Situation, Tier, TierEvent } from '../lib/types'

// Le seul écran qui a le droit de lire rewards. Côté joueur, la même requête
// renverrait une liste vide — c'est la base qui le garantit, pas cet écran.

type Props = { pact: Pact; onQuitter: () => void }

export default function Partenaire({ pact, onQuitter }: Props) {
  const [progres, setProgres] = useState<Progress | null>(null)
  const [bareme, setBareme] = useState<Situation[]>([])
  const [paliers, setPaliers] = useState<Tier[]>([])
  const [aValider, setAValider] = useState<Day[]>([])
  const [jours, setJours] = useState<Day[]>([])
  const [bonus, setBonus] = useState<Bonus[]>([])
  const [coffresOuverts, setCoffresOuverts] = useState<TierEvent[]>([])
  const [coffres, setCoffres] = useState<Reward[]>([])
  const [bonusCaches, setBonusCaches] = useState<Bonus[]>([])
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    const [p, s, t, j, r, b, ev] = await Promise.all([
      supabase.rpc('progress', { p: pact.id }).single(),
      supabase.from('situation_scale').select('*').order('rank'),
      supabase.from('tiers').select('*').eq('pact_id', pact.id).order('points'),
      supabase.from('days').select('*').eq('pact_id', pact.id).order('day', { ascending: false }).limit(30),
      supabase.from('rewards').select('*').eq('pact_id', pact.id),
      supabase.from('bonuses').select('*').eq('pact_id', pact.id).order('created_at', { ascending: false }),
      supabase.from('tier_events').select('*').eq('pact_id', pact.id).order('tier_level'),
    ])
    const jours = (j.data as Day[]) ?? []
    setProgres((p.data as Progress) ?? null)
    setBareme((s.data as Situation[]) ?? [])
    setPaliers((t.data as Tier[]) ?? [])
    setAValider(jours.filter((d) => !d.validated_at))
    setJours(jours)
    setCoffres((r.data as Reward[]) ?? [])
    const tousLesBonus = (b.data as Bonus[]) ?? []
    setBonus(tousLesBonus)
    setBonusCaches(tousLesBonus.filter((x) => !x.revealed_at))
    setCoffresOuverts((ev.data as TierEvent[]) ?? [])
    setChargement(false)
  }, [pact.id])

  useEffect(() => {
    void charger()
  }, [charger])

  if (chargement) return <div className="ecran doux">Un instant…</div>

  const xp = progres?.total ?? 0
  const prochain = progres?.next_tier_level ?? null
  const coffrePret = prochain ? coffres.some((c) => c.tier_level === prochain) : true

  return (
    <div className="ecran">
      <Entete
        actions={
          <button className="fantome" onClick={onQuitter}>
            Réglages
          </button>
        }
      />

      <Blason progres={progres} />

      {bonusCaches.length > 0 && (
        <p className="faible" style={{ marginTop: -6 }}>
          {bonusCaches.length} bonus surprise en réserve, invisible{bonusCaches.length > 1 ? 's' : ''} pour lui.
        </p>
      )}

      {prochain && !coffrePret && (
        <div className="avis">
          Il est niveau {progres?.level ?? 1}, à {xp} XP. Le coffre du niveau{' '}
          {prochain} approche — as-tu prévu quelque chose&nbsp;?
        </div>
      )}

      {aValider.length > 0 && (
        <div className="carte">
          <h2>À valider</h2>
          {aValider.map((j) => (
            <Arbitrage key={j.id} jour={j} bareme={bareme} pact={pact} onFait={charger} />
          ))}
        </div>
      )}

      <BonusSurprise pact={pact} onFait={charger} />

      <Coffres pact={pact} paliers={paliers} coffres={coffres} onFait={charger} />

      <Journal
        jours={jours}
        bonus={bonus}
        bareme={bareme}
        paliers={paliers}
        coffres={coffresOuverts}
        avecMots
      />
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
    <div style={{ borderTop: '1px solid var(--bord)', paddingTop: 14, marginTop: 14 }}>
      <div className="rangee" style={{ justifyContent: 'space-between' }}>
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

      {jour.note && (
        <p className="doux" style={{ fontStyle: 'italic', marginTop: 8 }}>
          « {jour.note} »
        </p>
      )}

      {proposees.length === 0 ? (
        <p className="faible" style={{ marginTop: 8 }}>
          Rien de particulier ce jour-là.
        </p>
      ) : (
        <div className="quetes">
          {proposees.map((s) => (
            <div key={s.key} className="quete" data-cochee="true">
              <span style={{ flex: 1 }}>{s.label}</span>
              <div className="rangee">
                <button
                  className="fantome"
                  onClick={() =>
                    setPoints((p) => ({ ...p, [s.key]: Math.max(0, (p[s.key] ?? 0) - 1) }))
                  }
                  aria-label="Retirer un point"
                >
                  −
                </button>
                <span className="gain" style={{ minWidth: 34, textAlign: 'center' }}>
                  +{points[s.key] ?? 0}
                </span>
                <button
                  className="fantome"
                  onClick={() =>
                    setPoints((p) => ({ ...p, [s.key]: Math.min(5, (p[s.key] ?? 0) + 1) }))
                  }
                  aria-label="Ajouter un point"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="principal" onClick={valider} disabled={occupe} style={{ marginTop: 12 }}>
        {total > 0 ? `Accorder +${total} XP` : 'Rien à ajouter — valider'}
      </button>
    </div>
  )
}

/* ====================================================================== */

function BonusSurprise({ pact, onFait }: { pact: Pact; onFait: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [points, setPoints] = useState(2)
  const [mot, setMot] = useState('')
  const [tout_de_suite, setToutDeSuite] = useState(true)
  const [occupe, setOccupe] = useState(false)

  async function accorder() {
    setOccupe(true)
    await supabase.from('bonuses').insert({
      pact_id: pact.id,
      kind: 'surprise',
      points,
      label: 'Bonus surprise',
      message: mot.trim() || null,
      revealed_at: tout_de_suite ? new Date().toISOString() : null,
    })
    setOccupe(false)
    setOuvert(false)
    setMot('')
    onFait()
  }

  if (!ouvert)
    return (
      <div className="carte">
        <h2>Ton pouvoir spécial</h2>
        <p className="doux" style={{ marginBottom: 12 }}>
          De +1 à +5 XP, sans prévenir, quand tu trouves qu'il a traversé quelque
          chose de difficile.
        </p>
        <button className="discret" onClick={() => setOuvert(true)}>
          Accorder un bonus surprise
        </button>
      </div>
    )

  return (
    <div className="carte carte-or">
      <h2>Bonus surprise</h2>
      <div className="rangee" style={{ justifyContent: 'center', margin: '8px 0 16px' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setPoints(n)}
            style={{
              flex: 1,
              fontWeight: 800,
              color: points === n ? '#2a1c00' : 'var(--or)',
              background: points === n ? 'var(--or)' : 'transparent',
              borderColor: 'var(--or-sombre)',
            }}
          >
            +{n}
          </button>
        ))}
      </div>

      <div className="champ">
        <label htmlFor="mot-bonus">Un mot, s'il le mérite</label>
        <textarea
          id="mot-bonus"
          value={mot}
          onChange={(e) => setMot(e.target.value.slice(0, 500))}
          placeholder="Il ne le lira qu'au moment où tu le décides."
        />
      </div>

      <div className="quetes">
        <button
          className="quete"
          data-cochee={tout_de_suite}
          onClick={() => setToutDeSuite(true)}
        >
          <span className="case">{tout_de_suite ? '✓' : ''}</span>
          <span>Lui montrer tout de suite</span>
        </button>
        <button
          className="quete"
          data-cochee={!tout_de_suite}
          onClick={() => setToutDeSuite(false)}
        >
          <span className="case">{!tout_de_suite ? '✓' : ''}</span>
          <span>Garder en réserve — invisible pour lui</span>
        </button>
      </div>

      <button className="principal" onClick={accorder} disabled={occupe} style={{ marginTop: 12 }}>
        Accorder +{points} XP
      </button>
      <button className="fantome" onClick={() => setOuvert(false)}>
        Annuler
      </button>
    </div>
  )
}

/* ====================================================================== */

function Coffres({
  pact,
  paliers,
  coffres,
  onFait,
}: {
  pact: Pact
  paliers: Tier[]
  coffres: Reward[]
  onFait: () => void
}) {
  const [brouillons, setBrouillons] = useState<Record<number, string>>({})
  const [occupe, setOccupe] = useState<number | null>(null)

  async function enregistrer(niveau: number) {
    const contenu = (brouillons[niveau] ?? '').trim()
    if (!contenu) return
    setOccupe(niveau)
    await supabase.from('rewards').upsert(
      {
        pact_id: pact.id,
        tier_level: niveau,
        content: contenu,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pact_id,tier_level' },
    )
    setOccupe(null)
    setBrouillons((b) => ({ ...b, [niveau]: '' }))
    onFait()
  }

  return (
    <div className="carte">
      <h2>Tes coffres</h2>
      <p className="faible" style={{ marginBottom: 14 }}>
        Il connaît les paliers, jamais ce qu'il y a dedans. Cette liste ne quitte
        pas ton écran : son compte n'a pas le droit de la lire.
      </p>

      {paliers.map((t) => {
        const existant = coffres.find((c) => c.tier_level === t.level)
        const enEdition = brouillons[t.level] !== undefined && brouillons[t.level] !== ''
        return (
          <div
            key={t.level}
            style={{ borderTop: '1px solid var(--bord)', paddingTop: 12, marginTop: 12 }}
          >
            <div className="rangee" style={{ justifyContent: 'space-between' }}>
              <b style={{ color: 'var(--or)' }}>
                Niveau {t.level} — {t.label}
              </b>
            </div>
            {existant && !enEdition ? (
              <p className="doux" style={{ margin: '6px 0 0' }}>
                {existant.content}{' '}
                <button
                  className="fantome"
                  onClick={() => setBrouillons((b) => ({ ...b, [t.level]: existant.content }))}
                >
                  modifier
                </button>
              </p>
            ) : (
              <>
                <div className="champ" style={{ marginTop: 8, marginBottom: 8 }}>
                  <input
                    value={brouillons[t.level] ?? ''}
                    onChange={(e) =>
                      setBrouillons((b) => ({ ...b, [t.level]: e.target.value.slice(0, 1000) }))
                    }
                    placeholder={existant ? existant.content : 'Ce que tu lui prépares…'}
                  />
                </div>
                <button
                  className="discret"
                  onClick={() => enregistrer(t.level)}
                  disabled={occupe === t.level || !(brouillons[t.level] ?? '').trim()}
                >
                  Enregistrer
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
