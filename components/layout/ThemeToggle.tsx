'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-7 w-full" />
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:justify-start"
    >
      {isDark
        ? <Sun className="h-3.5 w-3.5 shrink-0" />
        : <Moon className="h-3.5 w-3.5 shrink-0" />
      }
      <span className="hidden lg:block">
        {isDark ? 'Modo día' : 'Modo noche'}
      </span>
    </button>
  )
}
