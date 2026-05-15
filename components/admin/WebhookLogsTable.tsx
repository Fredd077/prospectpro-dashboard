'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { LocalTime } from './LocalTime'
import type { Json } from '@/lib/types/database'

type LogRow = {
  id: string
  created_at: string
  status: string
  error_message: string | null
  payload: Json | null
  headers: Json | null
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'processed' || status === 'received'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : status === 'skipped'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={copy} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function ExpandedDetail({ log }: { log: LogRow }) {
  const payloadStr = log.payload ? JSON.stringify(log.payload, null, 2) : null
  const headersStr = log.headers ? JSON.stringify(log.headers, null, 2) : null

  return (
    <div className="px-4 pb-3 pt-1 space-y-2 bg-muted/5">
      {log.error_message && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mb-1">Mensaje de error</p>
          <p className="font-mono text-xs text-red-300 break-all whitespace-pre-wrap">{log.error_message}</p>
        </div>
      )}
      {payloadStr && (
        <div className="rounded-md border border-border bg-black/30">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Payload</span>
            <CopyBtn text={payloadStr} />
          </div>
          <pre className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground/80 overflow-x-auto max-h-64 scrollbar-thin">
            {payloadStr}
          </pre>
        </div>
      )}
      {headersStr && (
        <div className="rounded-md border border-border bg-black/30">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Headers</span>
            <CopyBtn text={headersStr} />
          </div>
          <pre className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground/80 overflow-x-auto max-h-32 scrollbar-thin">
            {headersStr}
          </pre>
        </div>
      )}
    </div>
  )
}

export function WebhookLogsTable({ logs }: { logs: LogRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggle(id: string) {
    setExpanded(prev => (prev === id ? null : id))
  }

  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50 italic">
        Aún no se han recibido webhooks para esta empresa.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-6 px-3 py-2.5" />
            <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px] whitespace-nowrap">
              Fecha
            </th>
            <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
              Estado
            </th>
            <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
              Detalle
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {logs.map((log) => {
            const isOpen = expanded === log.id
            const hasDetail = !!(log.error_message || log.payload)
            const preview = log.error_message
              ? log.error_message
              : log.payload
              ? JSON.stringify(log.payload).slice(0, 120)
              : '—'

            return (
              <Fragment key={log.id}>
                <tr
                  onClick={() => hasDetail && toggle(log.id)}
                  className={`transition-colors ${hasDetail ? 'cursor-pointer hover:bg-muted/15' : ''} ${isOpen ? 'bg-muted/10' : ''}`}
                >
                  <td className="pl-3 pr-1 py-2.5 text-muted-foreground/40">
                    {hasDetail
                      ? isOpen
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      : null}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                    <LocalTime iso={log.created_at} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground/60 max-w-sm">
                    <span className={`block truncate ${log.error_message ? 'text-red-400/70' : ''}`}>
                      {preview}
                    </span>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <ExpandedDetail log={log} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
