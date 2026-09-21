import { useEffect, useRef } from 'react'
import { CoffreIcone } from './CoffreIcone'
import type { Tier, TierEvent } from '../lib/types'

// La route des paliers : le tracé sur la carte. Verrouillé, un coffre n'affiche
// que son niveau et un point d'interrogation — jamais ce qu'il y a dedans.
//
// Elle se parcourt au doigt comme à la souris. Le doigt marchait déjà, par le
// défilement natif ; la souris, non, parce que la barre est masquée. D'où le
// glisser ci-dessous.

type Props = {
  paliers: Tier[]
  coffres: TierEvent[]
  niveau: number
  /** Le niveau du coffre touché, ou null pour refermer. */
  onChoisir: (niveau: number | null) => void
  choisi: number | null
}

export function Route({ paliers, coffres, niveau, onChoisir, choisi }: Props) {
  const piste = useRef<HTMLDivElement>(null)
  // Un glissement ne doit pas se terminer en ouverture de coffre.
  const aGlisse = useRef(false)

  // On cadre sur le prochain coffre, pas sur le début du voyage.
  const indexCourant = Math.max(
    0,
    paliers.findIndex((t) => t.level > niveau),
  )

  useEffect(() => {
    const etape = piste.current?.children[indexCourant] as HTMLElement | undefined
    etape?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [indexCourant])

  // Glisser à la souris. On n'attrape le pointeur qu'au-delà de quelques
  // pixels, pour ne pas transformer chaque clic en amorce de glissement.
  useEffect(() => {
    const el = piste.current
    if (!el) return

    let actif = false
    let departX = 0
    let departDefilement = 0

    const debut = (e: PointerEvent) => {
      aGlisse.current = false
      if (e.pointerType === 'touch') return // le doigt a déjà le défilement natif
      actif = true
      departX = e.clientX
      departDefilement = el.scrollLeft
      el.classList.add('glisse')
    }

    const bouge = (e: PointerEvent) => {
      if (!actif) return
      const ecart = e.clientX - departX
      if (Math.abs(ecart) > 3) {
        aGlisse.current = true
        if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId)
      }
      el.scrollLeft = departDefilement - ecart
    }

    const fin = (e: PointerEvent) => {
      if (!actif) return
      actif = false
      el.classList.remove('glisse')
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }

    let toucheX = 0
    const toucheDebut = (e: TouchEvent) => {
      aGlisse.current = false
      toucheX = e.touches[0]?.clientX ?? 0
    }
    const toucheBouge = (e: TouchEvent) => {
      if (Math.abs((e.touches[0]?.clientX ?? 0) - toucheX) > 6) aGlisse.current = true
    }
    el.addEventListener('touchstart', toucheDebut, { passive: true })
    el.addEventListener('touchmove', toucheBouge, { passive: true })

    el.addEventListener('pointerdown', debut)
    el.addEventListener('pointermove', bouge)
    el.addEventListener('pointerup', fin)
    el.addEventListener('pointercancel', fin)
    el.addEventListener('pointerleave', fin)
    return () => {
      el.removeEventListener('touchstart', toucheDebut)
      el.removeEventListener('touchmove', toucheBouge)
      el.removeEventListener('pointerdown', debut)
      el.removeEventListener('pointermove', bouge)
      el.removeEventListener('pointerup', fin)
      el.removeEventListener('pointercancel', fin)
      el.removeEventListener('pointerleave', fin)
    }
  }, [])

  if (paliers.length === 0) return null

  const prochain = paliers.find((t) => t.level > niveau)

  return (
    <div className="fenetre">
      <h2>La route</h2>

      {/* Le cadre porte les fondus sur les bords : ils disent qu'il y a
          quelque chose au-delà, sans écrire « faites glisser ». */}
      <div className="route-cadre">
        <div className="route" ref={piste}>
          {paliers.map((t, i) => {
            const evenement = coffres.find((c) => c.tier_level === t.level)
            const etat = !evenement
              ? 'verrouille'
              : evenement.delivered_at
                ? 'ouvert'
                : 'atteint'
            return (
              <div
                key={t.level}
                className="etape"
                data-etat={etat}
                data-choisi={choisi === t.level}
              >
                {i === indexCourant && etat === 'verrouille' && (
                  <span className="ici">▾</span>
                )}
                <button
                  className="coffre-noeud"
                  onClick={() => {
                    if (aGlisse.current) return
                    onChoisir(choisi === t.level ? null : t.level)
                  }}
                  aria-label={`Niveau ${t.level} — ${t.label}`}
                >
                  <CoffreIcone
                    etat={
                      etat === 'verrouille'
                        ? 'vide'
                        : etat === 'ouvert'
                          ? 'remis'
                          : 'a_remettre'
                    }
                    taille={30}
                  />
                </button>
                <span className="etape-xp">niv. {t.level}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="faible" style={{ margin: '4px 0 0' }}>
        {prochain
          ? `Prochain coffre au niveau ${prochain.level}. `
          : 'Tous les coffres sont franchis. '}
        Touche un coffre pour voir ce qu&rsquo;il a à dire.
      </p>
    </div>
  )
}
