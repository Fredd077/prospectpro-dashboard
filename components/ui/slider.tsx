'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
}

function Slider({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled,
}: SliderProps) {
  return (
    <div className={cn('relative flex w-full touch-none items-center', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        disabled={disabled}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className="w-full h-2 rounded-full accent-primary bg-secondary cursor-pointer disabled:opacity-50"
      />
    </div>
  )
}

export { Slider }
