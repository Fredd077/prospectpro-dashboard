/** Format number as USD currency */
export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Format number as percentage string */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/** Format integer with thousands separator */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es').format(Math.round(value))
}

/** Format integer for recipe outputs — no decimals (values are always Math.ceil'd) */
export function formatDecimal(value: number): string {
  return String(value)
}
