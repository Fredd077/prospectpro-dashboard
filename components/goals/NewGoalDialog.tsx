'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GoalForm } from './GoalForm'

interface NewGoalDialogProps {
  activities: Array<{ id: string; name: string }>
}

export function NewGoalDialog({ activities }: NewGoalDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Nueva meta
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear meta</DialogTitle>
          </DialogHeader>
          <GoalForm activities={activities} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
