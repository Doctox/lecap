import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './jeu.css'
import './scene.css'
import App from './App'


// Le service worker installe la nouvelle version en arrière-plan, puis prend la
// main — mais la page affichée reste celle d'avant. Sans ce rechargement, il
// faut charger DEUX fois pour voir une mise à jour, et on croit à un bug de
// déploiement. Le garde-fou évite la boucle si le navigateur émet l'évènement
// plusieurs fois.
if ('serviceWorker' in navigator) {
  let dejaRecharge = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dejaRecharge) return
    dejaRecharge = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
