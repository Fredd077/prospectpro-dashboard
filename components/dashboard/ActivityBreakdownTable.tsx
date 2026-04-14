'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcCompliance } from '@/lib/calculations/compliance'

export interface ActivityBreakdownRow {
  id: string
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  goal: number
  real: number
}

interface ActivityBreakdownTableProps {
  rows: ActivityBreakdownRow[]
}

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Networking',
  networking_lead: 'Lead Net.',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

function semColor(pct: number): string {
  if (pct >= 100) return '#1D9E75'
  if (pct >= 70)  return '#BA7517'
  return '#E24B4A'
}

function semBg(pct: number): string {
  if (pct >= 100) return 'rgba(29,158,117,0.1)'
  if (pct >= 70)  return 'rgba(186,117,23,0.1)'
  return 'rgba(226,75,74,0.1)'
}

// ─── Column layout helpers ───────────────────────────────────────────────────
const COL = {
  activity: { flex: 1, minWidth: 200 } as React.CSSProperties,
  meta:     { width: 70,  textAlign: 'center'  as const, flexShrink: 0 },
  real:     { width: 70,  textAlign: 'center'  as const, flexShrink: 0 },
  gap:      { width: 70,  textAlign: 'center'  as const, flexShrink: 0 },
  cumpl:    { width: 90,  textAlign: 'right'   as const, flexShrink: 0 },
}

const HDR: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  fontWeight: 500,
}

const ROW_BORDER: React.CSSProperties = {
  borderBottom: '0.5px solid rgba(255,255,255,0.06)',
}

// ─── Section separator ───────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 6px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        color: '#00D9FF',
        background: 'rgba(0,217,255,0.08)',
        border: '1px solid rgba(0,217,255,0.2)',
        borderRadius: 4,
        padding: '2px 8px',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

// ─── Activity row ────────────────────────────────────────────────────────────
function ActivityRow({ row }: { row: ActivityBreakdownRow }) {
  const { pct, deviation } = calcCompliance(row.real, row.goal)
  const color = semColor(pct)
  const bg    = semBg(pct)

  return (
    <div
      className="abt-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        ...ROW_BORDER,
        transition: 'background 0.15s',
      }}
    >
      {/* Activity name + channel */}
      <div style={COL.activity}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.88)', display: 'block' }}>
          {row.name}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: 1 }}>
          {CHANNEL_LABELS[row.channel] ?? row.channel}
        </span>
      </div>

      {/* META */}
      <div style={COL.meta}>
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.6)' }}>
          {row.goal}
        </span>
      </div>

      {/* REAL */}
      <div style={COL.real}>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
          {row.real}
        </span>
      </div>

      {/* GAP — hidden on mobile */}
      <div style={COL.gap} className="abt-gap">
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: deviation >= 0 ? '#1D9E75' : '#E24B4A',
        }}>
          {deviation >= 0 ? '+' : ''}{deviation}
        </span>
      </div>

      {/* CUMPL */}
      <div style={COL.cumpl}>
        <span style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color,
          background: bg,
          borderRadius: 4,
          padding: '2px 7px',
        }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// ─── Total row ───────────────────────────────────────────────────────────────
function TotalRow({ label, goal, real, isGrand = false }: {
  label: string
  goal: number
  real: number
  isGrand?: boolean
}) {
  const { pct, deviation } = calcCompliance(real, goal)
  const color = semColor(pct)
  const bg    = semBg(pct)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '10px 16px',
      background: isGrand ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
      ...(!isGrand ? ROW_BORDER : {}),
    }}>
      <div style={COL.activity}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: isGrand ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
        }}>
          {label}
        </span>
      </div>
      <div style={COL.meta}>
        <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.6)' }}>
          {goal}
        </span>
      </div>
      <div style={COL.real}>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
          {real}
        </span>
      </div>
      <div style={COL.gap} className="abt-gap">
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: deviation >= 0 ? '#1D9E75' : '#E24B4A',
        }}>
          {deviation >= 0 ? '+' : ''}{deviation}
        </span>
      </div>
      <div style={COL.cumpl}>
        <span style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color,
          background: bg,
          borderRadius: 4,
          padding: '2px 7px',
        }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function ActivityBreakdownTable({ rows }: ActivityBreakdownTableProps) {
  const [collapsed, setCollapsed] = useState(false)

  const outbound = rows.filter((r) => r.type === 'OUTBOUND')
  const inbound  = rows.filter((r) => r.type === 'INBOUND')

  const totalGoal = rows.reduce((s, r) => s + r.goal, 0)
  const totalReal = rows.reduce((s, r) => s + r.real, 0)

  if (rows.length === 0) return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── Collapse toggle ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Desglose por actividad</h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {!collapsed && (
        <div style={{
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0d0d0d',
          overflow: 'hidden',
        }}>

          {/* ── Column headers ─────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ ...COL.activity, ...HDR }}>Actividad</div>
            <div style={{ ...COL.meta,     ...HDR }}>Meta</div>
            <div style={{ ...COL.real,     ...HDR }}>Real</div>
            <div style={{ ...COL.gap,      ...HDR }} className="abt-gap">Gap</div>
            <div style={{ ...COL.cumpl,    ...HDR }}>Cumpl.</div>
          </div>

          {/* ── OUTBOUND section ───────────────────────────────────────── */}
          {outbound.length > 0 && (
            <>
              <SectionDivider label="Outbound" />
              {outbound.map((row) => <ActivityRow key={row.id} row={row} />)}
              {outbound.length > 1 && (
                <TotalRow
                  label="Total Outbound"
                  goal={outbound.reduce((s, r) => s + r.goal, 0)}
                  real={outbound.reduce((s, r) => s + r.real, 0)}
                />
              )}
            </>
          )}

          {/* ── INBOUND section ────────────────────────────────────────── */}
          {inbound.length > 0 && (
            <>
              <SectionDivider label="Inbound" />
              {inbound.map((row) => <ActivityRow key={row.id} row={row} />)}
              {inbound.length > 1 && (
                <TotalRow
                  label="Total Inbound"
                  goal={inbound.reduce((s, r) => s + r.goal, 0)}
                  real={inbound.reduce((s, r) => s + r.real, 0)}
                />
              )}
            </>
          )}

          {/* ── Grand total ────────────────────────────────────────────── */}
          <TotalRow
            label="Total General"
            goal={totalGoal}
            real={totalReal}
            isGrand
          />
        </div>
      )}

      {/* ── Mobile: hide GAP column ────────────────────────────────────── */}
      <style>{`
        @media (max-width: 767px) { .abt-gap { display: none !important; } }
        .abt-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>
    </div>
  )
}
