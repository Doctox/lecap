export type Role = 'player' | 'partner'

export type Pact = {
  id: string
  created_at: string
  join_code: string
  player_id: string | null
  partner_id: string | null
  player_consent_at: string | null
  partner_consent_at: string | null
  timezone: string
  day_rollover_hour: number
}

export type Situation = {
  key: string
  label: string
  points: number
  rank: number
}

export type Tier = {
  pact_id: string
  /** Le coffre s'ouvre à ce NIVEAU, plus à un total d'XP : la courbe des
      niveaux est quadratique, elle étale les coffres toute seule. */
  level: number
  label: string
}

export type Day = {
  id: string
  pact_id: string
  day: string
  status: 'zero' | 'ecart'
  situations: string[]
  note: string | null
  declared_at: string
  validated_at: string | null
}

export type Bonus = {
  id: string
  pact_id: string
  day_id: string | null
  kind: 'situation' | 'surprise'
  points: number
  label: string | null
  message: string | null
  created_at: string
  revealed_at: string | null
}

export type TierEvent = {
  id: string
  pact_id: string
  tier_level: number
  reached_at: string
  celebrated_at: string | null
  delivered_at: string | null
}

/** Réservé au binôme. Aucune requête depuis un écran joueur. */
export type Reward = {
  id: string
  pact_id: string
  tier_level: number
  content: string
  updated_at: string
}

export type Progress = {
  total: number
  current_streak: number
  best_streak: number
  zero_days: number
  level: number
  next_tier_level: number | null
  next_tier_label: string | null
  /** XP à atteindre pour le prochain coffre, calculé côté base. */
  next_tier_xp: number | null
}

/**
 * La journée bascule à 4h du matin : une soirée déclarée à 1h compte sur la
 * veille. Sans ça, tenir jusqu'à minuit passé coûterait un point.
 */
export function gameDay(rolloverHour = 4, now = new Date()): string {
  const d = new Date(now)
  if (d.getHours() < rolloverHour) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
