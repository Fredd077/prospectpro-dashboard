import { ReactNode } from 'react'

interface TopBarProps {
  title: string
  description?: string
  action?: ReactNode
}

export function TopBar({ title, description, action }: TopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
      <div className="flex items-center gap-3">
        {/* Accent bar */}
        <div className="h-5 w-[3px] rounded-full bg-primary shrink-0" />
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground/60">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
