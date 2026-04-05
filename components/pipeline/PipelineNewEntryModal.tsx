'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineEntryForm } from './PipelineEntryForm'

interface PipelineNewEntryModalProps {
  stages: string[]
  scenarioId: string | null
}

export function PipelineNewEntryModal({ stages, scenarioId }: PipelineNewEntryModalProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSaved(_id: string) {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Nuevo registro
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Modal */}
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Registrar movimiento en el pipeline</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <PipelineEntryForm
                stages={stages}
                scenarioId={scenarioId}
                onSaved={handleSaved}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
