import { addYears, format, startOfMonth, subDays } from "date-fns"

export function generateFiscalYearLabel(startDate: Date): string {
  const normalizedStart = startOfMonth(startDate)

  if (normalizedStart.getMonth() + 1 === 1) {
    return format(normalizedStart, "yyyy")
  }

  const startYear = normalizedStart.getFullYear()
  return `${startYear}-${startYear + 1}`
}

export function getCurrentFiscalYear(fiscalYearStartMonth: number): {
  start: Date
  end: Date
} {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const startYear = currentMonth >= fiscalYearStartMonth ? currentYear : currentYear - 1
  const start = new Date(startYear, fiscalYearStartMonth - 1, 1)
  const end = subDays(addYears(start, 1), 1)

  return { start, end }
}

export function getMonthLabel(date: Date): string {
  return format(date, "MMM-yyyy")
}
