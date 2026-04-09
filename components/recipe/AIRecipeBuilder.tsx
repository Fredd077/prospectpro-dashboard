'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SavedRecipe {
  id: string
}

const INITIAL_MESSAGE: Message = {
  role: 'user',
  content: '__start__',
}

interface AIRecipeBuilderProps {
  onSaved?: () => void
}

export function AIRecipeBuilder({ onSaved }: AIRecipeBuilderProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [savedRecipe, setSavedRecipe] = useState<SavedRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_RETRIES = 3

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    if (savedRecipe && onSaved) {
      const timer = setTimeout(() => onSaved(), 2500)
      return () => clearTimeout(timer)
    }
  }, [savedRecipe, onSaved])

  function removePlaceholder() {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last.role === 'assistant' && last.content === '') return prev.slice(0, -1)
      return prev
    })
  }

  async function sendMessages(msgs: Message[], attempt = 0) {
    setIsStreaming(true)
    if (attempt === 0) {
      setError(null)
      setRetryCount(0)
    }

    const assistantPlaceholder: Message = { role: 'assistant', content: '' }
    setMessages((prev) => {
      // Don't double-add placeholder on retry — last message is already an empty assistant bubble
      const last = prev[prev.length - 1]
      if (last.role === 'assistant' && last.content === '') return prev
      return [...prev, assistantPlaceholder]
    })

    let receivedContent = false
    let failed = false

    try {
      const res = await fetch('/api/ai-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.error) {
              failed = true
              removePlaceholder()
              break
            }

            if (parsed.text) {
              receivedContent = true
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.text }
                }
                return updated
              })
            }

            if (parsed.action === 'saved' && parsed.id) {
              setSavedRecipe({ id: parsed.id })
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      // Stream closed with no content (e.g. Vercel timeout before first token)
      if (!receivedContent) {
        failed = true
        removePlaceholder()
      }
    } catch {
      failed = true
      removePlaceholder()
    }

    if (failed) {
      const nextAttempt = attempt + 1
      if (nextAttempt < MAX_RETRIES) {
        setRetryCount(nextAttempt)
        await new Promise((r) => setTimeout(r, 1200))
        return sendMessages(msgs, nextAttempt)
      }
      setError('No se pudo conectar con el coach después de varios intentos. ¿Intentamos de nuevo?')
      setRetryCount(0)
    }

    setIsStreaming(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function handleStart() {
    setStarted(true)
    sendMessages([INITIAL_MESSAGE])
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    setInput('')
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    sendMessages(newMessages)
  }

  function handleReset() {
    setMessages([INITIAL_MESSAGE])
    setInput('')
    setSavedRecipe(null)
    setError(null)
    setStarted(false)
    setRetryCount(0)
  }

  // Visible messages: skip the hidden __start__ trigger
  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && m.content === '__start__')
  )

  if (!started) {
    return (
      <div className="rounded-xl border border-cyan-500/30 bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recetario con IA</h3>
            <p className="text-xs text-muted-foreground">Tu coach de ventas te guía paso a paso</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Un agente experto en metodología Sandler te hace las preguntas correctas y calcula tu embudo comercial automáticamente.
        </p>
        <button
          onClick={handleStart}
          className="flex items-center gap-2 rounded-md bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Empezar →
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-card flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/10">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Coach de Ventas IA</span>
          {isStreaming && retryCount > 0 && (
            <span className="text-xs text-amber-400/80 animate-pulse">
              Reconectando... ({retryCount}/{MAX_RETRIES - 1})
            </span>
          )}
          {isStreaming && retryCount === 0 && (
            <span className="text-xs text-cyan-400/70 animate-pulse">escribiendo...</span>
          )}
        </div>
        <button
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          title="Reiniciar conversación"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {visibleMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted/50 text-foreground rounded-bl-sm border border-border/50'
              )}
            >
              {msg.content.replace(/\{"action":"save_recipe"[^}]*(?:\{[^}]*\}[^}]*)?\}/g, '').trim() || (
                <span className="flex gap-1 items-center text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Saved confirmation card */}
        {savedRecipe && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">¡Tu Recetario está listo! 🎉</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tu escenario comercial fue creado y guardado correctamente. Ahora necesitas:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Activar el escenario en tu Recetario</li>
                <li>Configurar tus actividades de prospección</li>
                <li>¡Empezar a registrar tu progreso diario!</li>
              </ol>
              {onSaved && (
                <button
                  onClick={onSaved}
                  className="w-full rounded-md bg-emerald-500/20 border border-emerald-500/30 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  Continuar → Configurar actividades
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error — only shown after all retries exhausted */}
        {error && (
          <div className="flex justify-center">
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
              <span>{error}</span>
              <button
                onClick={() => { setError(null); sendMessages(messages, 0) }}
                className="underline hover:no-underline whitespace-nowrap"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-border px-3 py-3 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={savedRecipe ? 'Escenario guardado ✓' : 'Escribe tu respuesta...'}
          disabled={isStreaming || !!savedRecipe}
          className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming || !!savedRecipe}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
