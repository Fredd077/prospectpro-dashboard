/**
 * seed-demo.mts — Cuenta demo de ProspectPro con datos realistas precargados.
 *
 * Empresa: "Andina Trade Co" (exportadora agroindustrial) con 1 gerente
 * player-coach + 3 vendedores por región, recetarios, actividades,
 * 60 días hábiles de historial y pipeline coherente.
 *
 * Uso:
 *   npm run seed:demo
 *
 * Es idempotente: borra cualquier dato demo anterior (correos *demo@prospectpro.cloud)
 * y lo recrea desde cero. Útil para resetear la demo antes de cada reunión.
 *
 * Reglas de fechas: SOLO usa utilidades de lib/utils/dates.ts (todayISO,
 * addDaysToISO). El día de la semana se calcula con aritmética pura sobre la
 * cadena YYYY-MM-DD (algoritmo de Sakamoto), y las fechas del mes en curso se
 * construyen por partes (YYYY-MM-DD), nunca con new Date ni parseISO, para
 * evitar el bug de fechas corridas un día (Colombia, UTC-5).
 *
 * El Recetario (pestañas Rendimiento/Dashboard) lee de pipeline_simple filtrando
 * por entry_date dentro del MES EN CURSO y exige que cada oportunidad tenga
 * origin_activity_id. Por eso todas las oportunidades se fechan dentro del mes
 * actual y se vinculan a una actividad de origen.
 */
import { randomUUID } from 'node:crypto'
// Explicit .ts extensions: Node's native ESM/TS runner requires them
// (tsconfig has allowImportingTsExtensions enabled so tsc accepts them too).
import { getSupabaseServiceClient } from '../lib/supabase/service.ts'
import { calcRecipe } from '../lib/calculations/recipe.ts'
import { todayISO, addDaysToISO } from '../lib/utils/dates.ts'
import type {
  Database,
  ProfileUpdate,
  RecipeScenarioInsert,
  ActivityInsert,
  ActivityLogInsert,
  PipelineSimpleInsert,
} from '../lib/types/database'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type Stage = PipelineSimpleInsert['stage']
type Sb = ReturnType<typeof getSupabaseServiceClient>

// ─── Constantes ────────────────────────────────────────────────────────────
const COMPANY = 'Andina Trade Co'
const DOMAIN = '@prospectpro.cloud'
const PASSWORD = 'DemoAndina2026!'
const FUNNEL_STAGES = ['Actividad', 'Reunión', 'Propuesta', 'Cierre']
const WORKING_DAYS = 20
// Cuántos meses de historial generar (mes actual + anteriores). 4 cubre el
// trimestre en curso + un mes extra, para que las vistas de mes anterior y
// trimestre del Recetario/Dashboard tengan datos coherentes.
const HISTORY_MONTHS = 4

// Etapas reales del enum de pipeline_simple
const PIPE = {
  cita:      'Cita agendada',
  reagendar: 'Reagendar',
  primera:   'Primera reu ejecutada/Propuesta en preparación',
  propuesta: 'Propuesta Presentada',
  facturar:  'Por facturar/cobrar',
} satisfies Record<string, Stage>

// Etapas que el Recetario cuenta como "reunión real" (reunión ya ejecutada)
const REUNION_STAGES = new Set<Stage>([PIPE.primera, PIPE.propuesta, PIPE.facturar])

// ─── Definición de usuarios ──────────────────────────────────────────────────
interface UserDef {
  key: string
  fullName: string
  email: string
  market: string
  orgRole: 'manager' | 'member'
  isPlayerCoach: boolean
  recipe: { goal: number; ticket: number; outRates: number[]; inRates: number[] }
  // perf: personalidad en el historial de activity_logs (cumplimiento + ausencias)
  perf: { min: number; max: number; missRate: number }
  // pipeline: forma del pipeline del mes en curso
  pipeline: { effFactor: number; stalled: boolean; earlyCount: number; lostCount: number }
}

const USERS: UserDef[] = [
  {
    key: 'ricardo', fullName: 'Ricardo Demo', email: `ricardo.demo${DOMAIN}`,
    market: 'Gerencia', orgRole: 'manager', isPlayerCoach: true,
    recipe: { goal: 400000, ticket: 60000, outRates: [33, 36, 39], inRates: [40, 40, 40] },
    perf: { min: 0.80, max: 0.95, missRate: 0.05 },
    pipeline: { effFactor: 0.85, stalled: false, earlyCount: 3, lostCount: 1 },
  },
  {
    key: 'laura', fullName: 'Laura Demo', email: `laura.demo${DOMAIN}`,
    market: 'Norteamérica', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 350000, ticket: 50000, outRates: [32, 35, 38], inRates: [40, 40, 40] },
    perf: { min: 0.90, max: 1.10, missRate: 0.02 },
    pipeline: { effFactor: 1.0, stalled: true, earlyCount: 4, lostCount: 1 },
  },
  {
    key: 'carlos', fullName: 'Carlos Demo', email: `carlos.demo${DOMAIN}`,
    market: 'Europa', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 300000, ticket: 55000, outRates: [30, 33, 36], inRates: [40, 38, 40] },
    perf: { min: 0.60, max: 0.80, missRate: 0.08 },
    pipeline: { effFactor: 0.70, stalled: true, earlyCount: 3, lostCount: 2 },
  },
  {
    key: 'andres', fullName: 'Andrés Demo', email: `andres.demo${DOMAIN}`,
    market: 'LATAM', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 270000, ticket: 42000, outRates: [31, 34, 37], inRates: [38, 40, 38] },
    perf: { min: 0.30, max: 0.50, missRate: 0.30 },
    pipeline: { effFactor: 0.40, stalled: true, earlyCount: 4, lostCount: 2 },
  },
]

// ─── Plantilla de actividades (venta B2B internacional) ──────────────────────
// `expected`     = reuniones esperadas/mes por actividad (alimenta eficiencia y alineación).
// `meetingSkill` = qué tan bien ese canal CONVIERTE A CITA (multiplica la eficiencia).
// `closeSkill`   = qué tan bien CONVIERTE A CIERRE (multiplica la tasa de cierre).
// `execSkill`    = qué tan consistentemente se EJECUTA la actividad (afecta el cumplimiento en logs).
// La combinación crea fortalezas y debilidades por canal que el Dashboard y el Coach AI detectan.
interface ActTemplate {
  name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; weight: number; sort: number
  expected: number; meetingSkill: number; closeSkill: number; execSkill: number
}
const ACTIVITY_TEMPLATE: ActTemplate[] = [
  // Fuerte: buena cita y buen cierre
  { name: 'Llamadas de prospección',      type: 'OUTBOUND', channel: 'Teléfono', weight: 30, sort: 1, expected: 5, meetingSkill: 1.05, closeSkill: 1.00, execSkill: 1.00 },
  // Débil: genera pocas citas y cierra poco
  { name: 'Correos comerciales',          type: 'OUTBOUND', channel: 'Email',    weight: 25, sort: 2, expected: 3, meetingSkill: 0.60, closeSkill: 0.70, execSkill: 0.65 },
  // Trae citas (se ejecuta mucho) pero CONVIERTE MAL A CIERRE
  { name: 'Mensajes de LinkedIn',         type: 'OUTBOUND', channel: 'LinkedIn', weight: 25, sort: 3, expected: 3, meetingSkill: 0.95, closeSkill: 0.45, execSkill: 1.05 },
  // Fuerte: la videollamada cierra muy bien
  { name: 'Videollamadas de seguimiento', type: 'OUTBOUND', channel: 'Video',    weight: 20, sort: 4, expected: 2, meetingSkill: 1.10, closeSkill: 1.20, execSkill: 1.00 },
  // Inbound estable
  { name: 'Respuestas a inbound',         type: 'INBOUND',  channel: 'Múltiple', weight: 60, sort: 5, expected: 2, meetingSkill: 1.00, closeSkill: 1.00, execSkill: 1.00 },
  // Débil en ambos
  { name: 'Demos de producto',            type: 'INBOUND',  channel: 'Video',    weight: 40, sort: 6, expected: 2, meetingSkill: 0.70, closeSkill: 0.60, execSkill: 0.70 },
]

// ─── Pools de nombres para oportunidades de comercio exterior ────────────────
const CITY_POOL: Record<string, string[]> = {
  'Gerencia':      ['Tokyo', 'Singapore', 'Sydney', 'Dubai', 'Seoul', 'Shanghai', 'Mumbai', 'Hong Kong', 'Bangkok', 'Auckland'],
  'Norteamérica':  ['Seattle', 'Chicago', 'Boston', 'Denver', 'Austin', 'Toronto', 'Vancouver', 'Miami', 'Portland', 'Atlanta'],
  'Europa':        ['Hamburg', 'Amsterdam', 'Paris', 'Milan', 'Barcelona', 'Berlin', 'Rotterdam', 'Lyon', 'Vienna', 'Madrid'],
  'LATAM':         ['Bogotá', 'Lima', 'Santiago', 'CDMX', 'São Paulo', 'Monterrey', 'Quito', 'Buenos Aires', 'Guayaquil', 'Medellín'],
}
const BIZ_TYPES = [
  'Coffee Roasters', 'Organic Importers', 'Fine Foods', 'Specialty Trading', 'Gourmet Distributors',
  'Food Importers', 'Premium Grocers', 'Cacao Traders', 'Agro Importers', 'Specialty Foods',
]
const FIRST_NAMES = ['Erik', 'Sophie', 'James', 'Megan', 'Daniel', 'Olivia', 'Robert', 'Andrea', 'Kevin', 'Laura',
  'Lukas', 'Anouk', 'Camille', 'Marco', 'Núria', 'Hannah', 'Gonzalo', 'Valentina', 'Matías', 'Diego',
  'Haruki', 'Wei', 'Emily', 'Omar', 'Min-ji', 'Sara', 'Tomás', 'Irene', 'Pavel', 'Yuki']
const LAST_NAMES = ['Lindqvist', 'Tremblay', 'Carter', 'Brooks', 'Ramirez', 'Bennett', 'Hayes', 'Morales', 'Park', 'Whitman',
  'Becker', 'de Vries', 'Laurent', 'Bianchi', 'Soler', 'Schmidt', 'Vargas', 'Ríos', 'Fuentes', 'Herrera',
  'Tanaka', 'Tan', 'Watson', 'Al-Farsi', 'Kim', 'Novak', 'Costa', 'García', 'Petrov', 'Sato']

// ─── Helpers de fecha (sin new Date / parseISO) ──────────────────────────────
/** Día de semana por aritmética pura (Sakamoto). true si es sábado o domingo. */
function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const yy = m < 3 ? y - 1 : y
  const dow = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7
  return dow === 0 || dow === 6
}

/** [año, mes, día] del día de hoy en Bogotá. */
function currentYMD(): [number, number, number] {
  const [y, m, d] = todayISO().split('-').map(Number)
  return [y, m, d]
}

/** Partes del mes a `offset` meses atrás del actual (0 = mes actual). maxDay acota
 *  a 28 (evita problemas de fin de mes) y, para el mes actual, a hoy. */
function monthOffsetParts(offset: number): { ty: number; mm: string; maxDay: number } {
  const [cy, cm, cd] = currentYMD()
  const total = cy * 12 + (cm - 1) - offset
  const ty = Math.floor(total / 12)
  const tm = (total % 12) + 1
  const mm = String(tm).padStart(2, '0')
  const maxDay = offset === 0 ? Math.min(28, Math.max(1, cd)) : 28
  return { ty, mm, maxDay }
}

/** Primer día (ISO) del mes a `offset` meses atrás. */
function monthStartISO(offset: number): string {
  const { ty, mm } = monthOffsetParts(offset)
  return `${ty}-${mm}-01`
}

/** Días hábiles (lun–vie) desde el inicio del mes más antiguo de la ventana hasta hoy. */
function businessDaysWindow(months: number): string[] {
  const oldest = monthStartISO(months - 1)
  const out: string[] = []
  let cursor = todayISO()
  // Comparación lexicográfica de YYYY-MM-DD es válida cronológicamente.
  while (cursor >= oldest) {
    if (!isWeekendISO(cursor)) out.unshift(cursor)
    cursor = addDaysToISO(cursor, -1)
  }
  return out
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// ─── Reset idempotente ───────────────────────────────────────────────────────
async function resetDemo(sb: Sb): Promise<number> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)

  const demo = data.users.filter((u) => (u.email ?? '').endsWith(`demo${DOMAIN}`))
  for (const u of demo) {
    await sb.from('activity_logs').delete().eq('user_id', u.id)
    await sb.from('activities').delete().eq('user_id', u.id)
    await sb.from('recipe_scenarios').delete().eq('user_id', u.id)
    await sb.from('coach_messages').delete().eq('user_id', u.id)
    await sb.from('pipeline_simple').delete().eq('user_id', u.id)
    await sb.from('intelligence_reports').delete().eq('user_id', u.id)
    const { error: delErr } = await sb.auth.admin.deleteUser(u.id)
    if (delErr) throw new Error(`deleteUser ${u.email}: ${delErr.message}`)
  }
  return demo.length
}

// ─── Crear usuario (auth + perfil) ───────────────────────────────────────────
async function createUser(sb: Sb, def: UserDef, managerId: string | null): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({
    email: def.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: def.fullName, company: COMPANY },
  })
  if (error || !data.user) throw new Error(`createUser ${def.email}: ${error?.message ?? 'sin usuario'}`)
  const id = data.user.id
  const nowIso = `${todayISO()}T12:00:00Z`

  // El trigger handle_new_user ya creó el perfil como 'pending'; lo elevamos a active.
  const update: ProfileUpdate = {
    full_name: def.fullName,
    company: COMPANY,
    role: 'active',
    onboarding_completed: true,
    org_role: def.orgRole,
    manager_id: managerId,
    is_player_coach: def.isPlayerCoach,
    activated_at: nowIso,
  }
  const { error: upErr } = await sb.from('profiles').update(update).eq('id', id)
  if (upErr) throw new Error(`profiles.update ${def.email}: ${upErr.message}`)

  // Defensa por si el trigger no corrió: upsert garantiza la fila.
  const insert: ProfileInsert = { id, email: def.email, ...update }
  await sb.from('profiles').upsert(insert, { onConflict: 'id' })

  return id
}

// ─── Recetario + actividades ─────────────────────────────────────────────────
interface SeededActivity {
  id: string
  type: 'OUTBOUND' | 'INBOUND'
  daily_goal: number
  expected: number       // reuniones esperadas/mes
  convRate: number       // tasa de cierre (reunión → cierre), %  — ya incluye closeSkill
  meetingSkill: number   // conversión a cita (multiplica eficiencia)
  execSkill: number      // consistencia de ejecución (afecta cumplimiento en logs)
}

async function seedRecipeAndActivities(sb: Sb, def: UserDef, userId: string): Promise<SeededActivity[]> {
  const r = calcRecipe({
    monthly_revenue_goal: def.recipe.goal,
    average_ticket: def.recipe.ticket,
    outbound_pct: 80,
    working_days_per_month: WORKING_DAYS,
    funnel_stages: FUNNEL_STAGES,
    outbound_rates: def.recipe.outRates,
    inbound_rates: def.recipe.inRates,
  })

  const scenario: RecipeScenarioInsert = {
    user_id: userId,
    name: `Meta export ${def.market}`,
    description: `Escenario de exportación agroindustrial — ${def.market}`,
    is_active: true,
    monthly_revenue_goal: def.recipe.goal,
    average_ticket: def.recipe.ticket,
    outbound_pct: 80,
    working_days_per_month: WORKING_DAYS,
    funnel_stages: FUNNEL_STAGES,
    outbound_rates: def.recipe.outRates,
    inbound_rates: def.recipe.inRates,
    activities_needed_monthly: r.activities_needed_monthly,
    activities_needed_weekly: r.activities_needed_weekly,
    activities_needed_daily: r.activities_needed_daily,
  }
  const { error: recErr } = await sb.from('recipe_scenarios').insert(scenario)
  if (recErr) throw new Error(`recipe_scenarios ${def.email}: ${recErr.message}`)

  const outMonthly = r.outbound.activities_monthly
  const inMonthly = r.inbound.activities_monthly
  const lastOut = def.recipe.outRates[def.recipe.outRates.length - 1]
  const lastIn = def.recipe.inRates[def.recipe.inRates.length - 1]

  const rows: ActivityInsert[] = []
  const seeded: SeededActivity[] = []
  for (const t of ACTIVITY_TEMPLATE) {
    const typeTotal = t.type === 'OUTBOUND' ? outMonthly : inMonthly
    const monthly = Math.ceil((typeTotal * t.weight) / 100)
    const weekly = Math.ceil(monthly / 4)
    const daily = Math.ceil(monthly / WORKING_DAYS)
    // Tasa de cierre por actividad = última tasa del funnel del canal × habilidad de cierre del canal.
    // Esto crea canales que cierran bien (Videollamadas) y canales que cierran mal (LinkedIn).
    const baseRate = t.type === 'OUTBOUND' ? lastOut : lastIn
    const convRate = Math.round(Math.max(8, Math.min(55, baseRate * t.closeSkill)))
    const id = randomUUID()
    rows.push({
      id, user_id: userId, name: t.name, type: t.type, channel: t.channel,
      weight: t.weight, monthly_goal: monthly, weekly_goal: weekly, daily_goal: daily,
      status: 'active', sort_order: t.sort,
      conversion_rate_pct: convRate,
      meetings_expected: t.expected,
    })
    seeded.push({ id, type: t.type, daily_goal: daily, expected: t.expected, convRate, meetingSkill: t.meetingSkill, execSkill: t.execSkill })
  }
  const { error: actErr } = await sb.from('activities').insert(rows)
  if (actErr) throw new Error(`activities ${def.email}: ${actErr.message}`)

  return seeded
}

// ─── Historial de activity_logs (60 días hábiles con personalidad) ───────────
async function seedActivityLogs(sb: Sb, def: UserDef, userId: string, acts: SeededActivity[]): Promise<number> {
  const days = businessDaysWindow(HISTORY_MONTHS)
  const today = todayISO()
  const logs: ActivityLogInsert[] = []

  for (const date of days) {
    // Días enteros sin registro (más frecuentes en perfiles en riesgo)
    if (Math.random() < def.perf.missRate) continue
    for (const a of acts) {
      if (a.daily_goal <= 0) continue
      // Cumplimiento = personalidad del vendedor × consistencia de ejecución del canal + jitter.
      const factor = rand(def.perf.min, def.perf.max) * a.execSkill + (Math.random() - 0.5) * 0.15
      const real = Math.max(0, Math.round(a.daily_goal * Math.max(0, factor)))
      logs.push({
        id: randomUUID(), user_id: userId, activity_id: a.id, log_date: date,
        day_goal: a.daily_goal, real_executed: real, is_retroactive: date !== today,
      })
    }
  }

  // Insertar por lotes para no exceder límites de payload
  for (let i = 0; i < logs.length; i += 500) {
    const { error } = await sb.from('activity_logs').insert(logs.slice(i, i + 500))
    if (error) throw new Error(`activity_logs ${def.email}: ${error.message}`)
  }
  return logs.length
}

// ─── Pipeline de los últimos meses ───────────────────────────────────────────
// Genera oportunidades fechadas dentro de cada uno de los últimos HISTORY_MONTHS
// meses, cada una con origin_activity_id. Cada mes es coherente con la
// personalidad del vendedor (efficiencyFactor) con una leve tendencia de mejora
// hacia el presente, de modo que las vistas de mes anterior y trimestre tengan
// datos consistentes con los del mes actual.
function buildPipelineRows(def: UserDef, userId: string, acts: SeededActivity[]): {
  rows: PipelineSimpleInsert[]; reuniones: number; cierres: number; ingreso: number
} {
  const [cy, cm] = currentYMD()
  const curPrefix = `${cy}-${String(cm).padStart(2, '0')}`
  const cities = CITY_POOL[def.market] ?? CITY_POOL['Gerencia']
  const outActs = acts.filter((a) => a.type === 'OUTBOUND')
  const inActs = acts.filter((a) => a.type === 'INBOUND')

  const rows: PipelineSimpleInsert[] = []
  let n = 0

  // Crea una fila. entryDate/updatedAt ya vienen construidos (ISO del mes correcto).
  const addRow = (p: {
    stage: Stage; status: 'abierto' | 'perdido' | 'ganado'; act: SeededActivity
    entryDate: string; updatedAt: string; notes?: string
  }): void => {
    const idx = n++
    rows.push({
      id: randomUUID(),
      user_id: userId,
      stage: p.stage,
      status: p.status,
      prospect_type: p.act.type === 'OUTBOUND' ? 'outbound' : 'inbound',
      entry_date: p.entryDate,
      company_name: `${cities[idx % cities.length]} ${BIZ_TYPES[(Math.floor(idx / cities.length) + idx) % BIZ_TYPES.length]}`,
      prospect_name: `${FIRST_NAMES[idx % FIRST_NAMES.length]} ${LAST_NAMES[(idx * 3) % LAST_NAMES.length]}`,
      amount_usd: Math.round(def.recipe.ticket * (0.85 + (idx % 7) * 0.05)),
      notes: p.notes ?? null,
      origin_activity_id: p.act.id,
      updated_at: p.updatedAt,
    })
  }

  for (let offset = 0; offset < HISTORY_MONTHS; offset++) {
    const { ty, mm, maxDay } = monthOffsetParts(offset)
    const isoDay = (d: number) => `${ty}-${mm}-${String(Math.max(1, Math.min(maxDay, d))).padStart(2, '0')}`
    const tsDay = (d: number) => `${isoDay(d)}T15:00:00Z`

    // Tendencia del mes: leve mejora hacia el presente + jitter (la habilidad por canal
    // se aplica por actividad más abajo, para que cada canal tenga su propia eficiencia).
    const monthTrend = (1 - 0.06 * offset) * (0.95 + Math.random() * 0.1)
    let stalledLeft = offset === 0 && def.pipeline.stalled ? 1 : 0

    // Emite una oportunidad en el mes actual del loop.
    const emit = (stage: Stage, status: 'abierto' | 'perdido' | 'ganado', act: SeededActivity, opts?: { entryDay?: number; updatedDay?: number; notes?: string }) => {
      const entryDay = opts?.entryDay ?? 1 + (n % maxDay)
      const updDay = opts?.updatedDay ?? entryDay
      addRow({ stage, status, act, entryDate: isoDay(entryDay), updatedAt: tsDay(updDay), notes: opts?.notes })
    }

    // Por actividad: la eficiencia de cita combina personalidad × habilidad del canal × tendencia.
    // Así, dentro de un mismo vendedor, unos canales quedan en meta y otros con brecha.
    for (const act of acts) {
      const meetingEff = Math.max(0.2, Math.min(1.2, def.pipeline.effFactor * act.meetingSkill * monthTrend))
      const reun = Math.round(act.expected * meetingEff)
      const cierres = Math.min(reun, Math.round(reun * (act.convRate / 100)))
      for (let c = 0; c < cierres; c++) emit(PIPE.facturar, 'ganado', act)
      const openReun = reun - cierres
      for (let rIdx = 0; rIdx < openReun; rIdx++) {
        const stage = rIdx % 2 === 0 ? PIPE.primera : PIPE.propuesta
        if (stalledLeft > 0) {
          // Oportunidad frenada (solo mes actual): entró a inicio de mes, sin actualizar.
          emit(stage, 'abierto', act, { entryDay: 1, updatedDay: 1, notes: 'Sin avance — requiere seguimiento' })
          stalledLeft--
        } else {
          emit(stage, 'abierto', act)
        }
      }
    }

    // Etapas tempranas (cita agendada / reagendar): NO cuentan como reunión ejecutada.
    for (let e = 0; e < def.pipeline.earlyCount; e++) {
      const act = (e % 2 === 0 ? outActs[e % outActs.length] : inActs[e % inActs.length]) ?? acts[0]
      emit(e % 2 === 0 ? PIPE.cita : PIPE.reagendar, 'abierto', act)
    }

    // Oportunidades perdidas en etapa temprana (no inflan las reuniones ejecutadas).
    for (let l = 0; l < def.pipeline.lostCount; l++) {
      const act = outActs[l % Math.max(1, outActs.length)] ?? acts[0]
      emit(PIPE.cita, 'perdido', act, { notes: 'Presupuesto no aprobado este trimestre' })
    }
  }

  // Conteos del MES ACTUAL (misma lógica que el Recetario) para reportarlos exactos.
  let reuniones = 0
  let cierres = 0
  let ingreso = 0
  for (const row of rows) {
    if (!row.origin_activity_id || !row.entry_date?.startsWith(curPrefix)) continue
    if (REUNION_STAGES.has(row.stage)) reuniones++
    if (row.stage === PIPE.facturar) {
      cierres++
      ingreso += row.amount_usd ?? 0
    }
  }
  return { rows, reuniones, cierres, ingreso }
}

async function seedPipeline(sb: Sb, def: UserDef, userId: string, acts: SeededActivity[]): Promise<{ deals: number; reuniones: number; cierres: number; ingreso: number }> {
  const { rows, reuniones, cierres, ingreso } = buildPipelineRows(def, userId, acts)
  if (rows.length > 0) {
    const { error } = await sb.from('pipeline_simple').insert(rows)
    if (error) throw new Error(`pipeline_simple ${def.email}: ${error.message}`)
  }
  return { deals: rows.length, reuniones, cierres, ingreso }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✖ Faltan variables de entorno. Corre con: npm run seed:demo (carga .env.local)')
    process.exit(1)
  }

  const sb = getSupabaseServiceClient()

  console.log('▸ Reseteando datos demo anteriores…')
  const removed = await resetDemo(sb)
  console.log(`  ${removed} usuario(s) demo previos eliminados.`)

  console.log(`▸ Creando empresa demo "${COMPANY}"…`)
  // El gerente primero, para usar su id como manager_id de los vendedores.
  const ids: Record<string, string> = {}
  const manager = USERS.find((u) => u.orgRole === 'manager')
  if (!manager) throw new Error('No hay gerente definido en USERS')
  ids[manager.key] = await createUser(sb, manager, null)
  console.log(`  ✓ ${manager.fullName} (gerente player-coach)`)

  for (const def of USERS.filter((u) => u.orgRole === 'member')) {
    ids[def.key] = await createUser(sb, def, ids[manager.key])
    console.log(`  ✓ ${def.fullName} (${def.market})`)
  }

  console.log(`▸ Sembrando recetarios, actividades, historial y pipeline (${HISTORY_MONTHS} meses)…`)
  for (const def of USERS) {
    const userId = ids[def.key]
    const acts = await seedRecipeAndActivities(sb, def, userId)
    const nLogs = await seedActivityLogs(sb, def, userId, acts)
    const p = await seedPipeline(sb, def, userId, acts)
    const efic = Math.round((p.reuniones / ACTIVITY_TEMPLATE.reduce((s, t) => s + t.expected, 0)) * 100)
    console.log(
      `  ✓ ${def.fullName}: ${acts.length} actividades · ${nLogs} registros · ${p.deals} oport. (${HISTORY_MONTHS} meses) · ` +
      `mes actual: ${p.reuniones} reuniones / ${p.cierres} cierres ($${p.ingreso.toLocaleString('es-CO')}) · eficiencia ~${efic}%`,
    )
  }

  console.log('\n✅ Demo lista. Credenciales (contraseña común):\n')
  console.log(`   Contraseña: ${PASSWORD}\n`)
  for (const def of USERS) {
    const role = def.orgRole === 'manager' ? 'Gerente (player-coach)' : `Vendedor · ${def.market}`
    console.log(`   • ${def.email.padEnd(32)} ${role}`)
  }
  console.log('\n   Entra en https://prospectpro-dashboard.vercel.app/login\n')
}

await main().catch((err: unknown) => {
  console.error('\n✖ Error en seed-demo:', err instanceof Error ? err.message : err)
  process.exit(1)
})
