'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, KeyRound, RefreshCw } from 'lucide-react'
import { generateIntegrationApiKey } from '@/lib/actions/integrations'
import { CopyButton } from './CopyButton'

interface Props {
  hasExistingKey: boolean
  lastUsedAt: string | null
}

export function IntegrationsKeyManager({ hasExistingKey, lastUsedAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await generateIntegrationApiKey()
        setGeneratedKey(result.plaintext)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error generando la clave')
      }
    })
  }

  if (generatedKey) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Guarda esta clave ahora — no se volverá a mostrar
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted/40 border border-border px-3 py-2 font-mono text-xs text-foreground break-all">
              {generatedKey}
            </code>
            <CopyButton text={generatedKey} label="Copiar clave" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {hasExistingKey && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <span>
            Clave activa
            {lastUsedAt ? (
              <> · Último uso: <span className="font-mono">{new Date(lastUsedAt).toLocaleString('es-CO')}</span></>
            ) : (
              ' · Nunca usada'
            )}
          </span>
        </div>
      )}

      {hasExistingKey && (
        <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400/80 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Generar una nueva clave invalida la actual inmediatamente.
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        {hasExistingKey ? 'Regenerar API Key' : 'Generar API Key'}
      </button>
    </div>
  )
}
