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
 * cadena YYYY-MM-DD (algoritmo de Sakamoto), nunca con new Date ni parseISO,
 * para evitar el bug de fechas corridas un día (Colombia, UTC-5).
 */
import { randomUUID } from 'node:crypto'
import { getSupabaseServiceClient } from '../lib/supabase/service'
import { calcRecipe } from '../lib/calculations/recipe'
import { todayISO, addDaysToISO } from '../lib/utils/dates'
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
type DealStatus = NonNullable<PipelineSimpleInsert['status']>
type Ptype = NonNullable<PipelineSimpleInsert['prospect_type']>
type Sb = ReturnType<typeof getSupabaseServiceClient>

// ─── Constantes ────────────────────────────────────────────────────────────
const COMPANY = 'Andina Trade Co'
const DOMAIN = '@prospectpro.cloud'
const PASSWORD = 'DemoAndina2026!'
const FUNNEL_STAGES = ['Actividad', 'Reunión', 'Propuesta', 'Cierre']
const WORKING_DAYS = 20
const HISTORY_DAYS = 60

// Etapas reales del enum de pipeline_simple
const PIPE = {
  cita:      'Cita agendada',
  reagendar: 'Reagendar',
  primera:   'Primera reu ejecutada/Propuesta en preparación',
  propuesta: 'Propuesta Presentada',
  facturar:  'Por facturar/cobrar',
} satisfies Record<string, Stage>

// ─── Definición de usuarios ──────────────────────────────────────────────────
interface UserDef {
  key: string
  fullName: string
  email: string
  market: string
  orgRole: 'manager' | 'member'
  isPlayerCoach: boolean
  recipe: { goal: number; ticket: number; outRates: number[]; inRates: number[] }
  perf: { min: number; max: number; missRate: number }
}

const USERS: UserDef[] = [
  {
    key: 'ricardo', fullName: 'Ricardo Demo', email: `ricardo.demo${DOMAIN}`,
    market: 'Gerencia', orgRole: 'manager', isPlayerCoach: true,
    recipe: { goal: 400000, ticket: 60000, outRates: [33, 36, 39], inRates: [40, 40, 40] },
    perf: { min: 0.80, max: 0.95, missRate: 0.05 },
  },
  {
    key: 'laura', fullName: 'Laura Demo', email: `laura.demo${DOMAIN}`,
    market: 'Norteamérica', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 350000, ticket: 50000, outRates: [32, 35, 38], inRates: [40, 40, 40] },
    perf: { min: 0.90, max: 1.10, missRate: 0.02 },
  },
  {
    key: 'carlos', fullName: 'Carlos Demo', email: `carlos.demo${DOMAIN}`,
    market: 'Europa', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 300000, ticket: 55000, outRates: [30, 33, 36], inRates: [40, 38, 40] },
    perf: { min: 0.60, max: 0.80, missRate: 0.08 },
  },
  {
    key: 'andres', fullName: 'Andrés Demo', email: `andres.demo${DOMAIN}`,
    market: 'LATAM', orgRole: 'member', isPlayerCoach: false,
    recipe: { goal: 270000, ticket: 42000, outRates: [31, 34, 37], inRates: [38, 40, 38] },
    perf: { min: 0.30, max: 0.50, missRate: 0.30 },
  },
]

// ─── Plantilla de actividades (venta B2B internacional) ──────────────────────
interface ActTemplate { name: string; type: 'OUTBOUND' | 'INBOUND'; channel: string; weight: number; sort: number }
const ACTIVITY_TEMPLATE: ActTemplate[] = [
  { name: 'Llamadas de prospección',      type: 'OUTBOUND', channel: 'Teléfono', weight: 30, sort: 1 },
  { name: 'Correos comerciales',          type: 'OUTBOUND', channel: 'Email',    weight: 25, sort: 2 },
  { name: 'Mensajes de LinkedIn',         type: 'OUTBOUND', channel: 'LinkedIn', weight: 25, sort: 3 },
  { name: 'Videollamadas de seguimiento', type: 'OUTBOUND', channel: 'Video',    weight: 20, sort: 4 },
  { name: 'Respuestas a inbound',         type: 'INBOUND',  channel: 'Múltiple', weight: 60, sort: 5 },
  { name: 'Demos de producto',            type: 'INBOUND',  channel: 'Video',    weight: 40, sort: 6 },
]

// ─── Helpers de fecha (sin new Date / parseISO) ──────────────────────────────
/** Día de semana por aritmética pura (Sakamoto). true si es sábado o domingo. */
function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const yy = m < 3 ? y - 1 : y
  const dow = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7
  return dow === 0 || dow === 6
}

/** Últimos `count` días hábiles (lun–vie) como ISO, del más antiguo al más reciente. */
function lastBusinessDays(count: number): string[] {
  const out: string[] = []
  let cursor = todayISO()
  while (out.length < count) {
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
interface SeededActivity { id: string; daily_goal: number }

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

  const rows: ActivityInsert[] = []
  const seeded: SeededActivity[] = []
  for (const t of ACTIVITY_TEMPLATE) {
    const typeTotal = t.type === 'OUTBOUND' ? outMonthly : inMonthly
    const monthly = Math.ceil((typeTotal * t.weight) / 100)
    const weekly = Math.ceil(monthly / 4)
    const daily = Math.ceil(monthly / WORKING_DAYS)
    const id = randomUUID()
    rows.push({
      id, user_id: userId, name: t.name, type: t.type, channel: t.channel,
      weight: t.weight, monthly_goal: monthly, weekly_goal: weekly, daily_goal: daily,
      status: 'active', sort_order: t.sort,
    })
    seeded.push({ id, daily_goal: daily })
  }
  const { error: actErr } = await sb.from('activities').insert(rows)
  if (actErr) throw new Error(`activities ${def.email}: ${actErr.message}`)

  return seeded
}

// ─── Historial de activity_logs (60 días hábiles con personalidad) ───────────
async function seedActivityLogs(sb: Sb, def: UserDef, userId: string, acts: SeededActivity[]): Promise<number> {
  const days = lastBusinessDays(HISTORY_DAYS)
  const today = todayISO()
  const logs: ActivityLogInsert[] = []

  for (const date of days) {
    // Días enteros sin registro (más frecuentes en perfiles en riesgo)
    if (Math.random() < def.perf.missRate) continue
    for (const a of acts) {
      if (a.daily_goal <= 0) continue
      const factor = rand(def.perf.min, def.perf.max) + (Math.random() - 0.5) * 0.15
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

// ─── Pipeline ────────────────────────────────────────────────────────────────
interface DealSpec {
  company: string; prospect: string; stage: Stage; status: DealStatus; ptype: Ptype
  amount: number; entryDaysAgo: number; updatedDaysAgo: number; notes?: string
}

function buildDeals(key: string): DealSpec[] {
  switch (key) {
    case 'laura': // Norteamérica — 10 oportunidades, 3 ganadas
      return [
        { company: 'Nordic Coffee Roasters',     prospect: 'Erik Lindqvist', stage: PIPE.facturar,  status: 'ganado',  ptype: 'outbound', amount: 56000, entryDaysAgo: 40, updatedDaysAgo: 5 },
        { company: 'Maple Leaf Specialty Foods',  prospect: 'Sophie Tremblay', stage: PIPE.facturar, status: 'ganado',  ptype: 'outbound', amount: 48000, entryDaysAgo: 35, updatedDaysAgo: 4 },
        { company: 'Pacific Northwest Importers', prospect: 'James Carter',    stage: PIPE.facturar,  status: 'ganado',  ptype: 'inbound',  amount: 61000, entryDaysAgo: 30, updatedDaysAgo: 3 },
        { company: 'California Organic Distributors', prospect: 'Megan Brooks', stage: PIPE.propuesta, status: 'abierto', ptype: 'outbound', amount: 52000, entryDaysAgo: 20, updatedDaysAgo: 2 },
        { company: 'Texas Gourmet Trading',       prospect: 'Daniel Ramirez',  stage: PIPE.primera,   status: 'abierto', ptype: 'outbound', amount: 45000, entryDaysAgo: 18, updatedDaysAgo: 6 },
        { company: 'New York Fine Foods Co',      prospect: 'Olivia Bennett',  stage: PIPE.cita,      status: 'abierto', ptype: 'inbound',  amount: 58000, entryDaysAgo: 14, updatedDaysAgo: 1 },
        { company: 'Chicago Wholesale Grocers',   prospect: 'Robert Hayes',    stage: PIPE.primera,   status: 'abierto', ptype: 'outbound', amount: 50000, entryDaysAgo: 25, updatedDaysAgo: 12, notes: 'Esperando respuesta de compras' },
        { company: 'Florida Citrus Importers',    prospect: 'Andrea Morales',  stage: PIPE.propuesta, status: 'abierto', ptype: 'outbound', amount: 47000, entryDaysAgo: 12, updatedDaysAgo: 3 },
        { company: 'Seattle Specialty Coffee',    prospect: 'Kevin Park',      stage: PIPE.cita,      status: 'abierto', ptype: 'inbound',  amount: 55000, entryDaysAgo: 9,  updatedDaysAgo: 2 },
        { company: 'Boston Organic Markets',      prospect: 'Laura Whitman',   stage: PIPE.reagendar, status: 'abierto', ptype: 'outbound', amount: 42000, entryDaysAgo: 16, updatedDaysAgo: 5 },
      ]
    case 'carlos': // Europa — 6 oportunidades, 1 ganada
      return [
        { company: 'Hamburg Organic Importers',   prospect: 'Lukas Becker',    stage: PIPE.facturar,  status: 'ganado',  ptype: 'outbound', amount: 58000, entryDaysAgo: 33, updatedDaysAgo: 6 },
        { company: 'Amsterdam Fine Foods BV',      prospect: 'Anouk de Vries',  stage: PIPE.propuesta, status: 'abierto', ptype: 'outbound', amount: 60000, entryDaysAgo: 21, updatedDaysAgo: 4 },
        { company: 'Paris Gourmet Distribution',   prospect: 'Camille Laurent', stage: PIPE.primera,   status: 'abierto', ptype: 'inbound',  amount: 55000, entryDaysAgo: 28, updatedDaysAgo: 10, notes: 'Pendiente muestra de producto' },
        { company: 'Milan Specialty Trading',      prospect: 'Marco Bianchi',   stage: PIPE.cita,      status: 'abierto', ptype: 'outbound', amount: 52000, entryDaysAgo: 13, updatedDaysAgo: 2 },
        { company: 'Barcelona Food Importers',     prospect: 'Núria Soler',     stage: PIPE.primera,   status: 'abierto', ptype: 'outbound', amount: 50000, entryDaysAgo: 17, updatedDaysAgo: 5 },
        { company: 'Berlin Organic Trade GmbH',    prospect: 'Hannah Schmidt',  stage: PIPE.reagendar, status: 'abierto', ptype: 'inbound',  amount: 57000, entryDaysAgo: 10, updatedDaysAgo: 3 },
      ]
    case 'andres': // LATAM — 3 abiertas + 1 perdida
      return [
        { company: 'Lima Andes Exporters',         prospect: 'Gonzalo Vargas',  stage: PIPE.propuesta, status: 'perdido', ptype: 'outbound', amount: 40000, entryDaysAgo: 30, updatedDaysAgo: 14, notes: 'Presupuesto no aprobado este trimestre' },
        { company: 'Bogotá Premium Foods',         prospect: 'Valentina Ríos',  stage: PIPE.cita,      status: 'abierto', ptype: 'outbound', amount: 42000, entryDaysAgo: 12, updatedDaysAgo: 4 },
        { company: 'Santiago Trading Co',          prospect: 'Matías Fuentes',  stage: PIPE.primera,   status: 'abierto', ptype: 'inbound',  amount: 45000, entryDaysAgo: 22, updatedDaysAgo: 11, notes: 'No responde últimos correos' },
        { company: 'Importadora Ciudad de México', prospect: 'Diego Herrera',   stage: PIPE.cita,      status: 'abierto', ptype: 'outbound', amount: 38000, entryDaysAgo: 8,  updatedDaysAgo: 2 },
      ]
    case 'ricardo': // Player-coach — 5 oportunidades, 1 ganada
      return [
        { company: 'Tokyo Fine Foods Trading',     prospect: 'Haruki Tanaka',   stage: PIPE.facturar,  status: 'ganado',  ptype: 'outbound', amount: 65000, entryDaysAgo: 32, updatedDaysAgo: 5 },
        { company: 'Singapore Gourmet Imports',    prospect: 'Wei Lin Tan',     stage: PIPE.propuesta, status: 'abierto', ptype: 'outbound', amount: 60000, entryDaysAgo: 19, updatedDaysAgo: 3 },
        { company: 'Sydney Organic Distributors',  prospect: 'Emily Watson',    stage: PIPE.primera,   status: 'abierto', ptype: 'inbound',  amount: 58000, entryDaysAgo: 15, updatedDaysAgo: 4 },
        { company: 'Dubai Specialty Foods',        prospect: 'Omar Al-Farsi',   stage: PIPE.cita,      status: 'abierto', ptype: 'outbound', amount: 62000, entryDaysAgo: 11, updatedDaysAgo: 2 },
        { company: 'Seoul Premium Grocers',        prospect: 'Min-ji Kim',      stage: PIPE.reagendar, status: 'abierto', ptype: 'outbound', amount: 55000, entryDaysAgo: 14, updatedDaysAgo: 6 },
      ]
    default:
      return []
  }
}

async function seedPipeline(sb: Sb, def: UserDef, userId: string): Promise<number> {
  const today = todayISO()
  const specs = buildDeals(def.key)
  const rows: PipelineSimpleInsert[] = specs.map((p) => ({
    id: randomUUID(),
    user_id: userId,
    stage: p.stage,
    status: p.status,
    prospect_type: p.ptype,
    entry_date: addDaysToISO(today, -p.entryDaysAgo),
    company_name: p.company,
    prospect_name: p.prospect,
    amount_usd: p.amount,
    notes: p.notes ?? null,
    updated_at: `${addDaysToISO(today, -p.updatedDaysAgo)}T15:00:00Z`,
  }))
  if (rows.length === 0) return 0
  const { error } = await sb.from('pipeline_simple').insert(rows)
  if (error) throw new Error(`pipeline_simple ${def.email}: ${error.message}`)
  return rows.length
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

  console.log('▸ Sembrando recetarios, actividades, historial y pipeline…')
  for (const def of USERS) {
    const userId = ids[def.key]
    const acts = await seedRecipeAndActivities(sb, def, userId)
    const nLogs = await seedActivityLogs(sb, def, userId, acts)
    const nDeals = await seedPipeline(sb, def, userId)
    console.log(`  ✓ ${def.fullName}: ${acts.length} actividades · ${nLogs} registros · ${nDeals} oportunidades`)
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
