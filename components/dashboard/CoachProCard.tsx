import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface CoachProCardProps {
  weekLabel: string
  hasMessage: boolean
  compliancePct: number
}

export function CoachProCard({ weekLabel, hasMessage, compliancePct }: CoachProCardProps) {
  const badgeColors =
    compliancePct >= 100
      ? { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)', text: '#34d399' }
      : compliancePct >= 70
      ? { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' }
      : { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', text: '#f87171' }

  return (
    <Link
      href="/coach?type=weekly"
      className="coach-pro-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        background: 'rgba(0,217,255,0.03)',
        border: '1px solid rgba(0,217,255,0.18)',
        borderRadius: '10px',
        padding: '14px 20px',
        textDecoration: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Icon */}
      <span className="coach-sparkles" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Sparkles style={{ width: 18, height: 18, color: '#00D9FF' }} strokeWidth={1.5} />
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', lineHeight: 1.3, margin: 0 }}>
          Análisis Semanal Coach Pro
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', lineHeight: 1 }}>
          {weekLabel}
        </p>
      </div>

      {/* Compliance badge */}
      {hasMessage && (
        <span style={{
          flexShrink: 0,
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: badgeColors.bg,
          border: `1px solid ${badgeColors.border}`,
          color: badgeColors.text,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(compliancePct)}%
        </span>
      )}

      {/* CTA */}
      <span
        className="coach-pro-btn"
        style={{
          flexShrink: 0,
          padding: '7px 16px',
          borderRadius: 7,
          background: '#00D9FF',
          color: '#0a0a0a',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Ver análisis →
      </span>

      <style>{`
        .coach-sparkles {
          animation: coach-pulse 2.5s ease-in-out infinite;
        }
        @keyframes coach-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        .coach-pro-card:hover {
          border-color: rgba(0,217,255,0.45) !important;
          box-shadow: 0 0 16px rgba(0,217,255,0.08);
        }
        .coach-pro-card:hover .coach-pro-btn {
          opacity: 0.85;
        }
      `}</style>
    </Link>
  )
}
