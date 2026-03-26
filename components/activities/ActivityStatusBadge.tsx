import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ActivityStatusBadgeProps {
  status: 'active' | 'inactive'
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        status === 'active'
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
          : 'border-border bg-muted text-muted-foreground'
      )}
    >
      {status === 'active' ? 'Activa' : 'Inactiva'}
    </Badge>
  )
}
