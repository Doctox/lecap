import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Configuration Supabase manquante : renseigne VITE_SUPABASE_URL et ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY dans .env.local',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Une seule règle à ne jamais enfreindre dans ce fichier et ailleurs :
// aucune requête côté joueur ne touche `rewards`, ni directement, ni par
// jointure, ni « pour plus tard ». La base le refuserait de toute façon —
// c'est le test qu'on rejoue avant chaque mise en ligne — mais autant ne
// pas écrire la ligne qui demande.
