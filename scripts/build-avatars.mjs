// Découpe les douze portraits de rang depuis la planche d'avatars.
// À relancer si la planche change : npm run avatars
//
// La planche porte un numéro dans le coin de chaque case. On le recouvre d'un
// morceau du parchemin pris entre deux tuiles : même texture, même grain, et
// invisible à la taille d'affichage. Rogner le personnage aurait été plus
// simple mais lui aurait coupé un bras.

import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const SRC = 'assets-source/avatars-planche.png'

// Les trois panneaux partagent la même grille ; seule leur origine change.
const PX = 134
const PY = 166
const W = 128
const H = 133
const MARGE = 9 // on rogne dans le cadre : l'anneau le masque de toute façon

const PANNEAUX = {
  // Les mousses et les cuisiniers : 4 colonnes.
  m: { x: 23, y: 112 },
  // Les officiers et les capitaines : 4 colonnes.
  o: { x: 589, y: 112 },
  // Les amiraux : 2 colonnes et 4 rangées seulement — le reste de la
  // largeur est occupé par l'illustration du légendaire.
  a: { x: 1155, y: 112 },
}

// Un portrait par rang de src/lib/levels.ts, du mousse au grand cap.
const RANGS = [
  ['Mousse', 'm', 0, 0],
  ['Matelot', 'm', 0, 1],
  ['Gabier', 'm', 2, 0],
  ['Timonier', 'm', 2, 1],
  ['Navigateur', 'o', 0, 1],
  ['Quartier-maitre', 'o', 0, 0],
  ['Second', 'o', 1, 3],
  ['Capitaine', 'o', 2, 1],
  ['Cap-hornier', 'o', 3, 1],
  ['Doubleur de caps', 'a', 0, 0],
  ['Maitre a bord', 'a', 2, 0],
  ['Grand Cap', 'a', 3, 1],
]

async function portrait(panneau, r, c) {
  const p = PANNEAUX[panneau]
  const gx = Math.round(p.x + c * PX)
  const gy = Math.round(p.y + r * PY)

  const rustine = await sharp(SRC)
    .extract({ left: gx + W + 3, top: gy + 50, width: 5, height: 42 })
    .resize(52, 42, { fit: 'fill' })
    .blur(3)
    .toBuffer()

  return sharp(SRC)
    .extract({
      left: gx + MARGE,
      top: gy + MARGE,
      width: W - 2 * MARGE,
      height: H - MARGE - 14,
    })
    .composite([{ input: rustine, left: 0, top: 0, blend: 'over' }])
    .resize(192, 192, { fit: 'cover', position: 'top' })
    .webp({ quality: 84 })
    .toBuffer()
}

let total = 0
for (let i = 0; i < RANGS.length; i++) {
  const [nom, panneau, r, c] = RANGS[i]
  const image = await portrait(panneau, r, c)
  const fichier = `public/avatars/rang-${String(i + 1).padStart(2, '0')}.webp`
  await writeFile(fichier, image)
  total += image.length
  console.log(`${fichier}  ${nom}`)
}
console.log(`— ${RANGS.length} portraits, ${Math.round(total / 1024)} ko au total`)
