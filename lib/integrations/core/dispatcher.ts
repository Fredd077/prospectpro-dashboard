import type { CrmAdapter, NormalizedDealEvent } from '../types'
import { pipedriveAdapter } from '../pipedrive/adapter'
import { genericAdapter } from '../generic/adapter'

/**
 * To add a new CRM: create lib/integrations/<crm>/adapter.ts, implement CrmAdapter,
 * and insert it here before genericAdapter. No other files need to change.
 */
const ADAPTERS: CrmAdapter[] = [
  pipedriveAdapter,
  genericAdapter,   // must stay last — canHandle always returns true
]

/**
 * Finds the first adapter that can handle the payload and normalizes the event.
 * The x-crm-name synthetic header (injected by the route from integration.crm_name)
 * can be used by adapters for unambiguous matching.
 */
export function dispatch(
  payload: unknown,
  headers: Record<string, string>,
  config: Record<string, unknown> | null,
): NormalizedDealEvent {
  const adapter = ADAPTERS.find(a => a.canHandle(payload, headers)) ?? genericAdapter
  return adapter.normalize(payload, config)
}
