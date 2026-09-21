import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Pact } from './lib/types'
import Connexion from './screens/Connexion'
import Bienvenue from './screens/Bienvenue'
import Joueur from './screens/Joueur'
import Partenaire from './screens/Partenaire'
import Reglages from './screens/Reglages'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [pseudo, setPseudo] = useState<string | null>(null)
  const [pact, setPact] = useState<Pact | null>(null)
  const [reglages, setReglages] = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const charger = useCallback(async () => {
    if (!session) {
      setChargement(false)
      return
    }
    const [prof, duos] = await Promise.all([
      supabase.from('profiles').select('pseudo').eq('id', session.user.id).maybeSingle(),
      supabase.from('pacts').select('*').limit(1),
    ])
    setPseudo((prof.data as { pseudo: string } | null)?.pseudo ?? null)
    setPact(((duos.data as Pact[]) ?? [])[0] ?? null)
    setChargement(false)
  }, [session])

  useEffect(() => {
    setChargement(true)
    void charger()
  }, [charger])

  if (chargement) return <div className="ecran doux">Un instant…</div>
  if (!session) return <Connexion />

  // Le duo n'est complet que lorsque les deux rôles sont pourvus.
  const complet = pact !== null && pact.player_id !== null && pact.partner_id !== null

  if (!pseudo || !complet) {
    return (
      <Bienvenue
        userId={session.user.id}
        pseudoExistant={pseudo}
        onPret={() => void charger()}
        enAttente={pact && !complet ? pact.join_code : null}
      />
    )
  }

  if (reglages) {
    return (
      <Reglages
        pact={pact!}
        onRetour={() => setReglages(false)}
        onEfface={() => {
          setPact(null)
          setReglages(false)
          void charger()
        }}
      />
    )
  }

  const estJoueur = pact!.player_id === session.user.id
  return estJoueur ? (
    <Joueur pact={pact!} onQuitter={() => setReglages(true)} />
  ) : (
    <Partenaire pact={pact!} onQuitter={() => setReglages(true)} />
  )
}
