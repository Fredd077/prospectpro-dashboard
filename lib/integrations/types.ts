export type DealAction = 'created' | 'updated' | 'won' | 'lost'

export interface NormalizedDealEvent {
  /** Business action for this event */
  action: DealAction
  /** Deal/opportunity ID in the source CRM */
  externalId: string
  prospectName: string | null
  companyName: string | null
  amountUsd: number | null
  /**
   * Stage as resolved by the adapter — should be a valid ProspectPro stage name.
   * null means "keep existing stage" (for won/lost events where stage was already set).
   */
  stageInCrm: string | null
  /** CRM that produced this event, e.g. 'pipedrive' or 'generic' */
  source: string
  rawPayload: unknown
}

export interface CrmAdapter {
  /**
   * Returns true if this adapter can handle the given payload/headers.
   * Adapters are tested in registration order; the first match wins.
   */
  canHandle(payload: unknown, headers: Record<string, string>): boolean
  /**
   * Translates raw CRM payload → NormalizedDealEvent.
   * @throws {SkipError} to intentionally discard an event (not an error).
   */
  normalize(payload: unknown, config: Record<string, unknown> | null): NormalizedDealEvent
}

/** Throw from normalize() to mark the event as intentionally skipped (not an error). */
export class SkipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkipError'
  }
}
