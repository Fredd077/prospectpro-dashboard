/**
 * Backfill por única vez de las metas de actividad.
 *
 * Contexto: recalcActivityGoalsFromPerformance() solo corre cuando el usuario
 * guarda un campo en Rendimiento o activa un escenario. Las actividades que YA
 * tenían meetings_expected / conversion_rate_pct configurados desde antes del
 * cambio de modelo quedaron con las metas viejas (repartidas por el `weight`
 * roto, muchas en 0). Este script las pone al día de una sola vez.
 *
 * Uso:
 *   node --env-file=.env.local scripts/backfill-activity-goals.mts            (dry-run)
 *   node --env-file=.env.local scripts/backfill-activity-goals.mts --apply    (escribe)
 *
 * El dry-run NO escribe nada. El modo --apply delega en la MISMA función que usa
 * la app (recalcActivityGoalsFromPerformance), así que el resultado es idéntico
 * al que produciría el usuario guardando desde la interfaz — incluido el
 * re-snapshot de activity_logs.day_goal de hoy.
 */
import { getSupabaseServiceClient } from '../lib/supabase/service.ts'
import { recalcActivityGoalsFromPerformance } from '../lib/queries/activity-goals.ts'

const APPLY = process.argv.includes('--apply')
const DEFAULT_WORKING_DAYS = 20

const sb = getSupabaseServiceClient()

const [{ data: profiles }, { data: acts }, { data: scenarios }] = await Promise.all([
  sb.from('profiles').select('id,email'),
  sb.from('activities')
    .select('id,user_id,name,type,meetings_expected,conversion_rate_pct,monthly_goal,weekly_goal,daily_goal')
    .eq('status', 'active'),
  sb.from('recipe_scenarios')
    .select('user_id,working_days_per_month,created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false }),
])

const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]))

// Escenario activo más reciente por usuario (mismo criterio que la función real).
const wdOf = new Map<string, number>()
for (const s of scenarios ?? []) {
  if (!wdOf.has(s.user_id)) wdOf.set(s.user_id, s.working_days_per_month ?? DEFAULT_WORKING_DAYS)
}

const byUser = new Map<string, NonNullable<typeof acts>>()
for (const a of acts ?? []) {
  if (!byUser.has(a.user_id)) byUser.set(a.user_id, [])
  byUser.get(a.user_id)!.push(a)
}

interface Change {
  user: string
  name: string
  from: { m: number; w: number; d: number }
  to: { m: number; w: number; d: number }
  fromZero: boolean
}

const changes: Change[] = []
const usersToRun: string[] = []
let totalConfigurable = 0
let totalSkipped = 0

for (const [uid, list] of byUser) {
  const wd = wdOf.get(uid) ?? DEFAULT_WORKING_DAYS
  let userHasConfigurable = false

  for (const a of list) {
    const me = a.meetings_expected ?? 0
    const cr = a.conversion_rate_pct ?? 0
    if (me <= 0 || cr <= 0) { totalSkipped++; continue }

    userHasConfigurable = true
    totalConfigurable++

    const m = Math.ceil(me / (cr / 100))
    const w = Math.ceil(m / (wd / 5))
    const d = Math.ceil(m / wd)

    if (m === a.monthly_goal && w === a.weekly_goal && d === a.daily_goal) continue

    changes.push({
      user: emailOf.get(uid) ?? uid,
      name: a.name,
      from: { m: a.monthly_goal, w: a.weekly_goal, d: a.daily_goal },
      to: { m, w, d },
      fromZero: a.monthly_goal === 0,
    })
  }

  if (userHasConfigurable) usersToRun.push(uid)
}

const affectedUsers = new Set(changes.map((c) => c.user))
const fromZero = changes.filter((c) => c.fromZero)

console.log(`${APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (no escribe nada) ==='}\n`)
console.log(`Actividades activas totales:            ${(acts ?? []).length}`)
console.log(`  con ambos campos configurados:        ${totalConfigurable}`)
console.log(`  sin configurar (NO se tocan):         ${totalSkipped}`)
console.log('')
console.log(`Usuarios con actividades configurables: ${usersToRun.length}`)
console.log(`Usuarios que verían cambios:            ${affectedUsers.size}`)
console.log(`Actividades cuya meta cambiaría:        ${changes.length}`)
console.log(`  de meta 0 → meta calculada:           ${fromZero.length}   <-- las rotas por weight`)
console.log('')

if (changes.length > 0) {
  console.log('─── Detalle por actividad ───')
  let cur = ''
  for (const c of changes.sort((a, b) => a.user.localeCompare(b.user))) {
    if (c.user !== cur) { cur = c.user; console.log(`\n  ${cur}  (días hábiles: ${wdOf.get([...byUser.keys()].find(u => (emailOf.get(u) ?? u) === cur)!) ?? DEFAULT_WORKING_DAYS})`) }
    const flag = c.fromZero ? '  ← estaba en 0' : ''
    console.log(`     ${c.name}`)
    console.log(`        mes ${c.from.m} → ${c.to.m}   sem ${c.from.w} → ${c.to.w}   día ${c.from.d} → ${c.to.d}${flag}`)
  }
  console.log('')
}

if (!APPLY) {
  console.log('Nada se escribió. Corre con --apply para ejecutarlo.')
  process.exit(0)
}

let updated = 0, resnap = 0
for (const uid of usersToRun) {
  const r = await recalcActivityGoalsFromPerformance(sb, uid, wdOf.get(uid))
  updated += r.updated
  resnap += r.resnapshotted
}
console.log(`✓ Actividades actualizadas:        ${updated}`)
console.log(`✓ day_goal de HOY re-sincronizado: ${resnap} fila(s) de activity_logs`)
