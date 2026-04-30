import { ImageResponse } from 'next/og'

export const alt = 'ProspectPro — Tu War Room Comercial con IA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090C14',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,217,255,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              background: '#00D9FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#090C14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span style={{ fontSize: 56, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            ProspectPro
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.4,
            display: 'flex',
          }}
        >
          Tu War Room Comercial con IA
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 16, marginTop: 48 }}>
          {['Coach IA diario', 'Pipeline en tiempo real', 'Reportes automáticos'].map((label) => (
            <div
              key={label}
              style={{
                background: 'rgba(0,217,255,0.1)',
                border: '1px solid rgba(0,217,255,0.25)',
                borderRadius: 9999,
                padding: '10px 22px',
                fontSize: 18,
                color: '#00D9FF',
                fontWeight: 600,
                display: 'flex',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ position: 'absolute', bottom: 40, fontSize: 18, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
          app.prospectpro.cloud
        </div>
      </div>
    ),
    { ...size }
  )
}
