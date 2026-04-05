'use client'

import { Suspense } from 'react'
import { FunnelCheckinModal } from './FunnelCheckinModal'

interface PipelineNewEntryModalProps {
  stages: string[]
  scenarioId: string | null
}

export function PipelineNewEntryModal({ stages, scenarioId }: PipelineNewEntryModalProps) {
  // stages and scenarioId are passed from server but FunnelCheckinModal fetches them itself
  // We keep the prop signature for backwards compat with page.tsx
  void stages
  void scenarioId
  return (
    <Suspense>
      <FunnelCheckinModal
        triggerLabel="+ Registrar avance"
        allowDateEdit={true}
      />
    </Suspense>
  )
}
