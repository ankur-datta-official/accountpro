export function formatDashboardCurrency(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—"
  }

  const absolute = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))

  return value < 0 ? `BDT (${absolute})` : `BDT ${absolute}`
}

export function formatDashboardPercent(value: number | null, digits = 2) {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return "—"
  }

  return `${value.toFixed(digits)}%`
}

export function formatDashboardNumber(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—"
  }

  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 0,
  }).format(value)
}
