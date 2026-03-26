import { ReactNode } from 'react'

interface TopBarProps {
  title: string
  description?: string
  action?: ReactNode
}

export function TopBar({ title, description, action }: TopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
