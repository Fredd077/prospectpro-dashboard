'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'

interface HistoricalBannerProps {
  isHistorical: boolean
}

export function HistoricalBanner({ isHistorical }: HistoricalBannerProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  if (!isHistorical) return null

  function goToCurrent() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('refDate')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mx-8 mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-primary">
      <span className="text-base">🕐</span>
      <span>
        Viendo datos históricos —
        <button
          onClick={goToCurrent}
          className="underline ml-1 hover:text-primary/80 transition-colors"
        >
          volver al período actual
        </button>
      </span>
    </div>
  )
}
