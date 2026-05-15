'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Circle, ExternalLink } from 'lucide-react'

interface Props {
  isConfigured: boolean   // has key + crm + pipedrive config
  apiToken?: string       // user's Pipedrive token if known (not stored, just for link hint)
}

const STEPS = [
  {
    number: 1,
    title: 'Selecciona tu CRM',
    description: 'En la sección "Credenciales de tu CRM" más abajo, elige Pipedrive como tipo de CRM y guarda.',
    tip: null,
  },
  {
    number: 2,
    title: 'Genera tu API Key de ProspectPro',
    description: 'En la sección "API Key de ProspectPro", haz clic en "Generar API Key". Aparecerá la URL completa lista para copiar — incluyendo el parámetro ?key=... que necesitas en el paso siguiente.',
    tip: '⚠️ La clave solo se muestra una vez. Cópiala antes de salir de la página.',
  },
  {
    number: 3,
    title: 'Crea el webhook en Pipedrive',
    description: 'En Pipedrive ve a: Configuración → Herramientas y aplicaciones → Webhooks → + Webhook',
    substeps: [
      'URL de punto de término: pega la URL completa que copiaste (incluye el ?key=...)',
      'Event object: Trato',
      'Acción de evento: Todas',
      'Haz clic en Guardar',
    ],
    tip: null,
  },
  {
    number: 4,
    title: 'Obtén los IDs de tus etapas de Pipedrive',
    description: 'Necesitas el número de ID de cada etapa de tu pipeline en Pipedrive. Hay dos formas de obtenerlos:',
    substeps: [
      'Opción A — Por la API: abre en tu navegador https://api.pipedrive.com/v1/stages?api_token=TU_TOKEN (tu token está en Pipedrive → Configuración → Preferencias personales → API). Busca las etapas de tu pipeline activo y anota los "id" de cada una.',
      'Opción B — Por los logs: mueve un trato a una etapa no mapeada y en "Últimas llamadas" abajo verás el mensaje "Stage ID XX not mapped". Ese número XX es el ID de esa etapa.',
    ],
    tip: null,
  },
  {
    number: 5,
    title: 'Mapea las etapas en ProspectPro',
    description: 'En la sección "Configuración de Pipedrive" más abajo, ingresa el ID numérico de Pipedrive correspondiente a cada etapa de ProspectPro y guarda.',
    substeps: [
      'Cita agendada → el ID de tu etapa "Cita agendada" en Pipedrive',
      'Reagendar → el ID de tu etapa "Reagendar" en Pipedrive',
      '1ra Reunión → el ID de tu etapa "Primera reu ejecutada..." en Pipedrive',
      'Propuesta → el ID de tu etapa "Propuesta Presentada" en Pipedrive',
      'Cierre → el ID de tu etapa "Por facturar/cobrar" en Pipedrive',
    ],
    tip: null,
  },
  {
    number: 6,
    title: 'Verifica que funciona',
    description: 'Mueve cualquier trato de Pipedrive a otra etapa y espera hasta 10 segundos.',
    substeps: [
      'En "Últimas llamadas" abajo debe aparecer un registro con estado "processed" (verde)',
      'El trato debe aparecer automáticamente en tu Pipeline de ProspectPro',
      'Si ves "skipped — Stage ID X not mapped", repite el Paso 4 y 5 para ese ID',
    ],
    tip: null,
  },
]

export function PipedriveSetupGuide({ isConfigured }: Props) {
  const [open, setOpen] = useState(!isConfigured)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isConfigured
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            : <Circle className="h-4 w-4 text-amber-400 shrink-0" />
          }
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">
              {isConfigured ? 'Integración configurada' : 'Cómo conectar Pipedrive — Guía paso a paso'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isConfigured
                ? 'Tu Pipedrive ya está sincronizando con ProspectPro. Haz clic para ver la guía.'
                : '6 pasos · ~5 minutos · sin soporte técnico requerido'}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/50">
          {STEPS.map((step) => (
            <div key={step.number} className="px-5 py-4 flex gap-4">
              {/* Step number */}
              <div className="shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">{step.number}</span>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-2 min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

                {step.substeps && (
                  <ul className="space-y-1.5 mt-2">
                    {step.substeps.map((sub, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-primary/60 shrink-0 mt-0.5">→</span>
                        <span className="leading-relaxed">{sub}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {step.tip && (
                  <p className="text-[11px] rounded border border-amber-500/20 bg-amber-500/5 text-amber-400/80 px-3 py-1.5 leading-relaxed">
                    {step.tip}
                  </p>
                )}

                {/* Special link for step 4 */}
                {step.number === 4 && (
                  <a
                    href="https://app.pipedrive.com/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir Configuración de API en Pipedrive
                  </a>
                )}

                {/* Special link for step 3 */}
                {step.number === 3 && (
                  <a
                    href="https://app.pipedrive.com/settings/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir Webhooks en Pipedrive
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Footer note */}
          <div className="px-5 py-3 bg-muted/10">
            <p className="text-[11px] text-muted-foreground/60">
              ¿Algo no funciona? Revisa la sección "Últimas llamadas" — cada intento muestra el motivo exacto del error en la columna Payload.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
