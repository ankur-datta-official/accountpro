import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
} from "date-fns"

import type { DashboardPeriodKey, DashboardPeriodSelection } from "@/lib/dashboard/dashboard-types"

function clampDate(value: string, min: string, max: string) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function minDate(left: string, right: string) {
  return left <= right ? left : right
}

function formatRangeLabel(startDate: string, endDate: string) {
  return `${format(parseISO(startDate), "dd MMM yyyy")} – ${format(parseISO(endDate), "dd MMM yyyy")}`
}

export function resolveDashboardPeriodSelection({
  fiscalYear,
  requestedKey,
  requestedFrom,
  requestedTo,
  todayDate,
}: {
  fiscalYear: {
    start_date: string
    end_date: string
  }
  requestedKey?: string
  requestedFrom?: string
  requestedTo?: string
  todayDate: string
}): DashboardPeriodSelection {
  const key: DashboardPeriodKey =
    requestedKey === "month" ||
    requestedKey === "quarter" ||
    requestedKey === "custom" ||
    requestedKey === "fiscal-year"
      ? requestedKey
      : "fiscal-year"

  const maxDate = minDate(fiscalYear.end_date, todayDate)
  let hadValidationIssue = false
  let startDate = fiscalYear.start_date
  let endDate = maxDate
  let label = "This Fiscal Year"
  let customRange: DashboardPeriodSelection["customRange"] = null

  if (key === "month") {
    startDate = clampDate(format(startOfMonth(parseISO(maxDate)), "yyyy-MM-dd"), fiscalYear.start_date, maxDate)
    label = "This Month"
  } else if (key === "quarter") {
    startDate = clampDate(
      format(startOfQuarter(parseISO(maxDate)), "yyyy-MM-dd"),
      fiscalYear.start_date,
      maxDate
    )
    label = "This Quarter"
  } else if (key === "custom") {
    const safeFrom = requestedFrom ? clampDate(requestedFrom, fiscalYear.start_date, maxDate) : fiscalYear.start_date
    const safeTo = requestedTo ? clampDate(requestedTo, fiscalYear.start_date, maxDate) : maxDate

    startDate = safeFrom
    endDate = safeTo
    customRange = { from: safeFrom, to: safeTo }
    label = "Custom Range"

    if (requestedFrom !== safeFrom || requestedTo !== safeTo || safeFrom > safeTo) {
      hadValidationIssue = true
    }

    if (startDate > endDate) {
      startDate = fiscalYear.start_date
      endDate = maxDate
      customRange = { from: startDate, to: endDate }
    }
  }

  if (key === "month") {
    endDate = clampDate(format(endOfMonth(parseISO(maxDate)), "yyyy-MM-dd"), startDate, maxDate)
  }

  if (key === "quarter") {
    endDate = clampDate(format(endOfQuarter(parseISO(maxDate)), "yyyy-MM-dd"), startDate, maxDate)
  }

  const comparisonLength = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
  const comparisonEnd = format(addDays(parseISO(startDate), -1), "yyyy-MM-dd")
  const comparisonStart = format(addDays(parseISO(startDate), -comparisonLength), "yyyy-MM-dd")
  const comparison =
    comparisonStart >= fiscalYear.start_date && comparisonEnd >= fiscalYear.start_date
      ? {
          startDate: comparisonStart,
          endDate: comparisonEnd,
          label: formatRangeLabel(comparisonStart, comparisonEnd),
        }
      : null

  return {
    key,
    label,
    startDate,
    endDate,
    maxDate,
    periodLabel: key === "custom" ? formatRangeLabel(startDate, endDate) : label,
    asOfLabel: `As of ${format(parseISO(endDate), "dd MMM yyyy")}`,
    comparison,
    customRange,
    hadValidationIssue,
  }
}
