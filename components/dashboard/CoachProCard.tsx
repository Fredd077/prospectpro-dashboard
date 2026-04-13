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
      ? { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', text: '#34d399' }
      : compliancePct >= 70
      ? { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24' }
      : { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', text: '#f87171' }

  return (
    <div className="flex justify-center">
      <Link
        href="/coach?type=weekly"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '600px',
          background: '#0a0a0a',
          border: '1px solid #00D9FF',
          borderRadius: '12px',
          padding: '24px 32px',
          textDecoration: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        className="coach-pro-card"
      >
        {/* Sparkles icon with pulse */}
        <span className="coach-sparkles">
          <Sparkles style={{ width: 32, height: 32, color: '#00D9FF' }} strokeWidth={1.5} />
        </span>

        {/* Title */}
        <p style={{
          marginTop: 12,
          fontSize: 18,
          fontWeight: 500,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          Análisis Semanal Coach Pro
        </p>

        {/* Week label */}
        <p style={{
          marginTop: 4,
          fontSize: 13,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
        }}>
          {weekLabel}
        </p>

        {/* Compliance badge */}
        {hasMessage && (
          <span style={{
            display: 'inline-block',
            marginTop: 14,
            padding: '3px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: badgeColors.bg,
            border: `1px solid ${badgeColors.border}`,
            color: badgeColors.text,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(compliancePct)}% cumplimiento
          </span>
        )}

        {/* CTA button */}
        <span style={{
          marginTop: 20,
          padding: '10px 28px',
          borderRadius: 8,
          background: '#00D9FF',
          color: '#0a0a0a',
          fontSize: 14,
          fontWeight: 500,
        }}
          className="coach-pro-btn"
        >
          Ver mi análisis →
        </span>
      </Link>

      <style>{`
        .coach-sparkles {
          animation: coach-pulse 2s ease-in-out infinite;
        }
        @keyframes coach-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .coach-pro-card:hover {
          border-color: rgba(0,217,255,0.6) !important;
          box-shadow: 0 0 24px rgba(0,217,255,0.12);
        }
        .coach-pro-card:hover .coach-pro-btn {
          opacity: 0.85;
        }
      `}</style>
    </div>
  )
}
