/**
 * Resolver de módulos para los scripts de mantenimiento.
 *
 * El runner nativo de TypeScript de Node no lee `paths` de tsconfig.json, así que
 * los imports con alias `@/...` que usa el código de la app fallan con
 * ERR_MODULE_NOT_FOUND. Este hook los traduce a rutas relativas a la raíz del
 * proyecto y les añade la extensión que corresponda.
 *
 * Se usa así (ver package.json → "backfill:goals"):
 *   node --import ./scripts/alias-hook.mjs script.mts
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs']

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context)

  let target = new URL(specifier.slice(2), ROOT)

  // Sin extensión explícita: probar las conocidas, y luego index.*
  if (!EXTENSIONS.some((e) => target.pathname.endsWith(e))) {
    const base = target.href
    const found =
      EXTENSIONS.map((e) => base + e).find((c) => existsSync(fileURLToPath(new URL(c)))) ??
      EXTENSIONS.map((e) => `${base}/index${e}`).find((c) => existsSync(fileURLToPath(new URL(c))))
    if (found) target = new URL(found)
  }

  return nextResolve(target.href, context)
}
