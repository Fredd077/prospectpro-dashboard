'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface DailyCoachMessageProps {
  show: boolean
}

export function DailyCoachMessage({ show }: DailyCoachMessageProps) {
  const [message, setMessage]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [messageId, setMessageId] = useState<string | null>(null)
  const [comment, setComment]   = useState('')
  const [commentSaved, setCommentSaved] = useState(false)
  const hasFetched = useRef(false)
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!show || hasFetched.current) return
    hasFetched.current = true
    fetchCoachMessage()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [show])

  async function fetchCoachMessage(isRetry = false) {
    if (!isRetry) setLoading(true)

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'daily' }),
      })
      if (!res.ok || !res.body) throw new Error('fetch failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      setLoading(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.text) {
              setMessage((prev) => prev + parsed.text)
            }
            if (parsed.id) setMessageId(parsed.id)
            if (parsed.silent_error) {
              // Hide silently — don't update loading state
              setMessage('')
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      // Retry once after 3 seconds, then give up silently
      if (!isRetry) {
        retryRef.current = setTimeout(() => fetchCoachMessage(true), 3000)
      } else {
        setLoading(false)
        setMessage('')  // Hide card silently on double failure
      }
    }
  }

  async function handleCommentSave() {
    if (!comment.trim() || !messageId) return
    try {
      await fetch('/api/ai-coach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, comment: comment.trim() }),
      })
      setCommentSaved(true)
    } catch { /* silent */ }
  }

  // Don't render if not triggered
  if (!show) return null

  // Loading skeleton
  if (loading) {
    return (
      <div className="border-l-4 border-cyan-500/40 bg-primary/5 rounded-r-lg p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className="text-xs font-semibold text-cyan-400">Coach Pro</span>
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400">Análisis del día</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted/60 rounded w-11/12" />
          <div className="h-3 bg-muted/60 rounded w-4/5" />
          <div className="h-3 bg-muted/60 rounded w-9/12" />
        </div>
        <p className="text-xs text-muted-foreground italic">Coach Pro está analizando tu prospección...</p>
      </div>
    )
  }

  // If message ended up empty (silent failure), render nothing
  if (!message) return null

  return (
    <div className="border-l-4 border-cyan-500/50 bg-primary/5 rounded-r-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">🤖</span>
        <span className="text-xs font-semibold text-cyan-400">Coach Pro</span>
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-400 border border-cyan-500/20">
          Análisis del día
        </span>
      </div>

      {/* Message */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{message}</p>

      {/* Comment input */}
      {messageId && (
        <div className="pt-1 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">¿Quieres comentar algo?</p>
          {commentSaved ? (
            <p className="text-[11px] text-emerald-400">Comentario guardado ✓</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCommentSave()}
                placeholder="Escribe tu reflexión..."
                className="flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
              <button
                onClick={handleCommentSave}
                disabled={!comment.trim()}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  comment.trim()
                    ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20'
                    : 'text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                Guardar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
