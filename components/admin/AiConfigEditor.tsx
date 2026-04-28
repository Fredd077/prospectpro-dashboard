'use client'

import { useState, useCallback } from 'react'
import {
  Brain, BookOpen, BrainCircuit, FileText,
  Save, RotateCcw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, Loader2,
  Sliders, Type, Zap, Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiConfig, AiTone } from '@/lib/utils/ai-config'
import { AI_SECTIONS, AI_CONFIG_DEFAULTS } from '@/lib/utils/ai-config'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  initialConfigs: AiConfig[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  coach:        Brain,
  recipe:       BookOpen,
  gerente_chat: BrainCircuit,
  team_report:  FileText,
}

const TONES: { value: AiTone; label: string; description: string; color: string }[] = [
  { value: 'profesional',  label: 'Profesional',  description: 'Preciso, orientado a negocios',   color: 'text-blue-400   border-blue-400/40   bg-blue-400/10'   },
  { value: 'motivacional', label: 'Motivacional', description: 'Energizante, orientado a acción',  color: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10' },
  { value: 'analítico',    label: 'Analítico',    description: 'Detallado, basado en datos',       color: 'text-cyan-400   border-cyan-400/40   bg-cyan-400/10'   },
  { value: 'directo',      label: 'Directo',      description: 'Conciso, va al punto',             color: 'text-amber-400  border-amber-400/40  bg-amber-400/10'  },
  { value: 'amigable',     label: 'Amigable',     description: 'Cercano, conversacional',          color: 'text-violet-400 border-violet-400/40 bg-violet-400/10' },
]

const MAX_TOKENS_PRESETS = [
  { label: '300',  value: 300,  hint: 'Corto — respuestas concisas'      },
  { label: '500',  value: 500,  hint: 'Medio — análisis moderado'        },
  { label: '900',  value: 900,  hint: 'Detallado — reportes completos'   },
  { label: '1500', value: 1500, hint: 'Extenso — análisis estratégico'   },
  { label: '2000', value: 2000, hint: 'Muy largo — documentos completos' },
]

// ── Main component ────────────────────────────────────────────────────────────

export function AiConfigEditor({ initialConfigs }: Props) {
  const [activeSection, setActiveSection] = useState(AI_SECTIONS[0].key)
  const [configs, setConfigs]             = useState<Record<string, AiConfig>>(
    Object.fromEntries(initialConfigs.map((c) => [c.sectionKey, c]))
  )
  const [saving, setSaving]       = useState<string | null>(null)
  const [toast, setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [resetting, setResetting]     = useState<string | null>(null)

  const current = configs[activeSection]!
  const defaults = AI_CONFIG_DEFAULTS[activeSection]!

  const isDirty = current.systemPrompt      !== defaults.systemPrompt      ||
                  current.maxTokens         !== defaults.maxTokens         ||
                  current.tone              !== defaults.tone              ||
                  current.extraInstructions !== defaults.extraInstructions ||
                  !!current.updatedAt

  function patch(key: keyof AiConfig, value: unknown) {
    setConfigs((prev) => ({
      ...prev,
      [activeSection]: { ...prev[activeSection]!, [key]: value },
    }))
  }

  function patchSettings(key: string, value: unknown) {
    setConfigs((prev) => ({
      ...prev,
      [activeSection]: {
        ...prev[activeSection]!,
        settings: { ...prev[activeSection]!.settings, [key]: value },
      },
    }))
  }

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }, [])

  async function handleSave() {
    if (saving) return
    setSaving(activeSection)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key:        current.sectionKey,
          system_prompt:      current.systemPrompt,
          max_tokens:         current.maxTokens,
          tone:               current.tone,
          language:           current.language,
          extra_instructions: current.extraInstructions,
          settings:           current.settings,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      showToast('ok', `Config de "${current.displayName}" guardada correctamente.`)
      setConfigs((prev) => ({
        ...prev,
        [activeSection]: { ...prev[activeSection]!, updatedAt: new Date().toISOString() },
      }))
    } catch (e: any) {
      showToast('err', e.message ?? 'Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  async function handleReset() {
    if (!confirm(`¿Restaurar la configuración de "${current.displayName}" a los valores predeterminados?`)) return
    setResetting(activeSection)
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: activeSection }),
      })
      if (!res.ok) throw new Error('Error al restaurar')
      const def = AI_CONFIG_DEFAULTS[activeSection]!
      setConfigs((prev) => ({ ...prev, [activeSection]: { ...def, updatedAt: null, updatedBy: null } }))
      showToast('ok', `"${current.displayName}" restaurado a valores predeterminados.`)
    } catch (e: any) {
      showToast('err', e.message)
    } finally {
      setResetting(null)
    }
  }

  const previewPrompt = [
    current.tone ? `[TONO]: ${TONES.find(t => t.value === current.tone)?.description ?? ''}` : '',
    current.systemPrompt,
    current.extraInstructions ? `\nINSTRUCCIONES ADICIONALES:\n${current.extraInstructions}` : '',
  ].filter(Boolean).join('\n\n')

  return (
    <div className="flex gap-8 items-start">

      {/* ── Section tabs (left) ───────────────────────────────────────── */}
      <div className="w-64 shrink-0 space-y-1.5 sticky top-0">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/30 px-2 mb-4">Secciones</p>
        {AI_SECTIONS.map((section) => {
          const Icon    = SECTION_ICONS[section.key] ?? Settings2
          const conf    = configs[section.key]
          const isActive = section.key === activeSection
          const hasCustom = !!conf?.updatedAt
          return (
            <button key={section.key} onClick={() => setActiveSection(section.key)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-all border',
                isActive
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', isActive ? 'text-cyan-400' : '')} />
              <div className="min-w-0">
                <p className={cn('text-sm font-bold leading-tight', isActive ? 'text-white' : '')}>{section.displayName}</p>
                {hasCustom && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mt-1 block">
                    · Personalizado
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Editor (right) ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {(() => { const Icon = SECTION_ICONS[activeSection] ?? Settings2; return <Icon className="h-6 w-6 text-cyan-400" /> })()}
              <h2 className="text-xl font-black text-white">{current.displayName}</h2>
              {current.updatedAt && (
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-2.5 py-1 rounded border border-emerald-400/30 bg-emerald-400/10">
                  Personalizado
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 mt-1">{current.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleReset} disabled={!!resetting || !current.updatedAt}
              className="flex items-center gap-2 px-4 py-2 rounded border border-white/[0.08] text-xs font-bold uppercase tracking-wider text-white/40 hover:text-white/70 hover:border-white/20 disabled:opacity-30 transition-all">
              {resetting === activeSection ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Restaurar
            </button>
            <button onClick={handleSave} disabled={!!saving}
              className="flex items-center gap-2 px-5 py-2 rounded border border-cyan-400/40 bg-cyan-400/10 text-xs font-black uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(34,211,238,0.1)]">
              {saving === activeSection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>

        {/* ── Tone selector ──────────────────────────────────────────── */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-violet-400" />
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Tonalidad de respuesta</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {TONES.map((t) => (
              <button key={t.value} onClick={() => patch('tone', t.value)}
                className={cn(
                  'flex flex-col items-start px-4 py-2.5 rounded border text-left transition-all',
                  current.tone === t.value ? t.color : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60 bg-transparent',
                )}>
                <span className="text-xs font-black">{t.label}</span>
                <span className="text-[11px] opacity-70 mt-0.5">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Max tokens ────────────────────────────────────────────── */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Tokens máximos de respuesta</p>
            </div>
            <span className="text-2xl font-black font-mono text-amber-400">{current.maxTokens}</span>
          </div>
          <input type="range" min={100} max={4000} step={50}
            value={current.maxTokens}
            onChange={(e) => patch('maxTokens', Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:cursor-pointer mb-4"
          />
          <div className="flex flex-wrap gap-2.5">
            {MAX_TOKENS_PRESETS.map((p) => (
              <button key={p.value} onClick={() => patch('maxTokens', p.value)}
                className={cn(
                  'flex flex-col items-start px-3 py-2 rounded border transition-all',
                  current.maxTokens === p.value
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'
                )}>
                <span className="text-xs font-black font-mono">{p.label}</span>
                <span className="text-[11px] opacity-60 mt-0.5">{p.hint}</span>
              </button>
            ))}
          </div>

          {/* Coach per-frequency tokens */}
          {activeSection === 'coach' && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <p className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">
                Tokens por frecuencia de reporte
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'daily_tokens',   label: 'Diario',   default: 300  },
                  { key: 'weekly_tokens',  label: 'Semanal',  default: 500  },
                  { key: 'monthly_tokens', label: 'Mensual',  default: 800  },
                ].map(({ key, label, default: def }) => (
                  <div key={key} className="rounded bg-white/[0.03] border border-white/[0.06] p-3">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">{label}</p>
                    <input
                      type="number" min={100} max={4000} step={50}
                      value={Number(current.settings[key] ?? def)}
                      onChange={(e) => patchSettings(key, Number(e.target.value))}
                      className="w-full bg-transparent border-b border-white/10 text-amber-400 font-black font-mono text-lg focus:outline-none focus:border-amber-400/50 pb-1"
                    />
                    <p className="text-xs text-white/25 mt-1.5">tokens</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── System prompt ─────────────────────────────────────────── */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">System prompt</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-white/30">
                {current.systemPrompt.length.toLocaleString()} caracteres
              </span>
              <button onClick={() => patch('systemPrompt', defaults.systemPrompt)}
                className="text-xs text-white/30 hover:text-white/60 underline transition-colors">
                Restaurar default
              </button>
            </div>
          </div>
          <textarea
            value={current.systemPrompt}
            onChange={(e) => patch('systemPrompt', e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded bg-[#080b12] border border-white/[0.06] px-4 py-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-cyan-400/30 resize-y leading-relaxed"
            placeholder="Ingresa las instrucciones del sistema para este módulo de IA..."
          />
          <div className="flex items-start gap-2 mt-3">
            <Info className="h-3.5 w-3.5 text-white/20 shrink-0 mt-0.5" />
            <p className="text-xs text-white/30">
              El contexto de datos (actividades, pipeline, métricas) se inyecta automáticamente. Este prompt define la personalidad, estilo y reglas de comportamiento del AI.
            </p>
          </div>
        </div>

        {/* ── Extra instructions ────────────────────────────────────── */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Instrucciones adicionales</p>
            <span className="text-xs text-white/25 ml-1">(se agregan al final del system prompt)</span>
          </div>
          <textarea
            value={current.extraInstructions}
            onChange={(e) => patch('extraInstructions', e.target.value)}
            rows={5}
            placeholder="Ejemplo: Menciona siempre el nombre de la empresa. No uses emojis. Formato bullet points..."
            className="w-full rounded bg-[#080b12] border border-white/[0.06] px-4 py-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-emerald-400/30 resize-y leading-relaxed"
          />
        </div>

        {/* ── Preview prompt ────────────────────────────────────────── */}
        <div className="rounded-lg bg-[#0d1117] border border-white/[0.06] overflow-hidden">
          <button onClick={() => setShowPreview((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-white/40 hover:text-white/70 hover:bg-white/[0.02] transition-all">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Vista previa del prompt completo
            </span>
            {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showPreview && (
            <div className="border-t border-white/[0.06] px-5 py-4">
              <pre className="text-xs font-mono text-white/40 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                {previewPrompt}
              </pre>
            </div>
          )}
        </div>

        {/* Metadata */}
        {current.updatedAt && (
          <p className="text-xs text-white/25 font-mono text-right pb-4">
            Última modificación: {new Date(current.updatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-bold shadow-xl transition-all',
          toast.type === 'ok'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
            : 'border-red-400/30 bg-red-400/10 text-red-300'
        )}>
          {toast.type === 'ok'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
