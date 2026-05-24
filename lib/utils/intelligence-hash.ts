import { createHash } from 'crypto'

/**
 * Generates a deterministic SHA-256 hash of any report input object.
 *
 * Keys are sorted recursively before serialization so that object property
 * order never affects the result. Any change to a value — a single closed
 * deal, a rate, a meeting count — produces a different hash.
 */
export function hashReportData(data: unknown): string {
  const stable = JSON.stringify(sortKeys(data))
  return createHash('sha256').update(stable).digest('hex')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys(obj[k])
        return acc
      }, {})
  }
  return value
}
