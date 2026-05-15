'use client'

import { useState, useEffect } from 'react'

export function LocalTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(iso)

  useEffect(() => {
    setLabel(
      new Date(iso).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        year:     'numeric',
        month:    '2-digit',
        day:      '2-digit',
        hour:     '2-digit',
        minute:   '2-digit',
        second:   '2-digit',
        hour12:   false,
      })
    )
  }, [iso])

  return <span>{label}</span>
}
