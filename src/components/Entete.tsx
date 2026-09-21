import type { ReactNode } from 'react'

// L'en-tête de tous les écrans internes : le blason à la place du nom écrit.

export function Entete({ actions }: { actions?: ReactNode }) {
  return (
    <div className="entete">
      <img
        className="marque-logo"
        src={`${import.meta.env.BASE_URL}marque-200.png`}
        alt="Le Cap"
        width={200}
        height={185}
      />
      {actions}
    </div>
  )
}
