import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Servie depuis doctox.fr/lecap
export default defineConfig({
  base: '/lecap/',
  // Écoute aussi sur le réseau local, pour tester depuis un téléphone.
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        // L'application. Chemins relatifs à la racine du projet.
        main: 'index.html',
        // La page de présentation : une vraie page, servie à part, qui se
        // contente d'importer les feuilles de style du jeu pour montrer ses
        // écrans tels qu'ils sont. Elle doit s'ouvrir sans compte.
        presentation: 'presentation/index.html',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Le Cap',
        // Ce qui s'affiche sous l'icône, sur un écran d'accueil que d'autres voient.
        short_name: 'Le Cap',
        description: 'Un jeu à deux.',
        lang: 'fr',
        start_url: '/lecap/',
        scope: '/lecap/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#041b25',
        theme_color: '#041b25',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // La présentation n'est pas la coquille du jeu : inutile de la mettre
        // dans le cache de ceux qui ont déjà installé l'application.
        globIgnores: ['**/presentation/**'],
        // Aucune donnée de jeu en cache : la coquille seulement.
        navigateFallback: '/lecap/index.html',
        // …sauf la présentation, qui est une vraie page et non une route de
        // l'application. Sans cette exception, quiconque a déjà installé Le Cap
        // recevrait la coquille du jeu en tapant /lecap/presentation.
        navigateFallbackDenylist: [/^\/lecap\/presentation/],
        runtimeCaching: [],
      },
    }),
  ],
})
