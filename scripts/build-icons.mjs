// Génère les icônes et le logo web à partir du blason d'origine.
// Source : assets-source/logo.png (détouré, fond transparent, 1254×1254).
// À relancer seulement si le blason change : npm run icons

import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const SOURCE = 'assets-source/logo.png'
const FOND = '#041b25' // la même nuit que le fond de l'application

/**
 * Pose le blason sur un carré de nuit.
 * @param taille  côté du PNG produit
 * @param part    part du carré occupée par le blason (1 = pleine largeur)
 */
async function surFond(taille, part) {
  const blason = await sharp(SOURCE)
    .resize(Math.round(taille * part), Math.round(taille * part), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  return sharp({
    create: {
      width: taille,
      height: taille,
      channels: 4,
      background: FOND,
    },
  })
    .composite([{ input: blason, gravity: 'center' }])
    .png()
    .toBuffer()
}

const travaux = [
  // Icônes d'application : le blason respire un peu.
  { nom: 'icon-192.png', taille: 192, part: 0.88 },
  { nom: 'icon-512.png', taille: 512, part: 0.88 },
  // Maskable : le système rogne jusqu'à 20 % des bords, on rentre le dessin.
  { nom: 'icon-512-maskable.png', taille: 512, part: 0.62 },
  { nom: 'apple-touch-icon.png', taille: 180, part: 0.9 },
  { nom: 'favicon-64.png', taille: 64, part: 0.94 },
]

for (const { nom, taille, part } of travaux) {
  await writeFile(`public/${nom}`, await surFond(taille, part))
  console.log(`public/${nom} — ${taille}×${taille}`)
}

// Le blason seul, fond transparent, pour les en-têtes internes.
const logo = await sharp(SOURCE).resize(320, 320).png({ quality: 90 }).toBuffer()
await writeFile('public/logo-320.png', logo)
console.log(`public/logo-320.png — 320×320 (${Math.round(logo.length / 1024)} ko)`)

// Le blason avec le nom : réservé à l'écran d'accueil, où il a la place de se
// lire. Illisible en icône d'application, on ne l'y met pas.
for (const largeur of [200, 560, 1120]) {
  const marque = await sharp('assets-source/logo-nom.png')
    .resize({ width: largeur })
    .png({ quality: 90 })
    .toBuffer()
  await writeFile(`public/marque-${largeur}.png`, marque)
  console.log(`public/marque-${largeur}.png — ${largeur} px (${Math.round(marque.length / 1024)} ko)`)
}
