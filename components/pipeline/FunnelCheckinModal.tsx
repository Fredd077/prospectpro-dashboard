'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FunnelCheckin } from './FunnelCheckin'
import { getActiveScenarioForFunnel } from '@/lib/actions/pipeline'

interface FunnelCheckinModalProps {
  /** If provided, the open button is not rendered — control open state externally */
  open?: boolean
  onClose?: () => void
  /** If not provided, a trigger button is rendered */
  trigger?: React.ReactNode
  triggerLabel?: string
  allowDateEdit?: boolean
  defaultDate?: string
}

export function FunnelCheckinModal({
  open: controlledOpen,
  onClose,
  trigger,
  triggerLabel = '+ Registrar avance del funnel',
  allowDateEdit = true,
  defaultDate,
}: FunnelCheckinModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [scenario, setScenario] = useState<{ id: string; funnel_stages: string[] } | null | undefined>(undefined)
  const router = useRouter()

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  useEffect(() => {
    if (isOpen && scenario === undefined) {
      getActiveScenarioForFunnel().then(setScenario).catch(() => setScenario(null))
    }
  }, [isOpen, scenario])

  function handleClose() {
    if (controlledOpen !== undefined) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  function handleSaved() {
    handleClose()
    router.refresh()
  }

  return (
    <>
      {controlledOpen === undefined && (
        trigger ?? (
          <Button size="sm" onClick={() => setInternalOpen(true)}>
            <BarChart2 className="h-4 w-4 mr-1.5" />
            {triggerLabel}
          </Button>
        )
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sticky top-0 bg-card z-10">
              <h2 className="text-sm font-semibold text-foreground">Avance del Funnel</h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              {scenario === undefined && (
                <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
              )}
              {scenario === null && (
                <p className="text-sm text-amber-400 text-center py-8">
                  Configura un Recetario activo para usar esta función.
                </p>
              )}
              {scenario && (
                <FunnelCheckin
                  stages={scenario.funnel_stages}
                  scenarioId={scenario.id}
                  defaultDate={defaultDate}
                  allowDateEdit={allowDateEdit}
                  onSaved={handleSaved}
                  onCancel={handleClose}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
