'use client'

import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { FunnelCheckinModal } from './FunnelCheckinModal'

export function FunnelCheckinFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Registrar avance del funnel"
        className="fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <BarChart2 className="h-5 w-5" />
      </button>

      <FunnelCheckinModal
        open={open}
        onClose={() => setOpen(false)}
        allowDateEdit={true}
      />
    </>
  )
}
