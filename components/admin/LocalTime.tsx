'use client'

export function LocalTime({ iso }: { iso: string }) {
  return (
    <span suppressHydrationWarning>
      {new Date(iso).toLocaleString('es-CO')}
    </span>
  )
}
