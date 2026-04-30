import type { ClientType, PaymentModeInsert } from "@/lib/types"

export const fiscalYearMonths = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const

export const clientTypeOptions: Array<{ value: ClientType; label: string }> = [
  { value: "company", label: "Company" },
  { value: "individual", label: "Individual" },
  { value: "partnership", label: "Partnership" },
  { value: "ngo", label: "NGO" },
]

export function getFiscalYearMonthLabel(month: number | null | undefined) {
  return fiscalYearMonths.find((item) => item.value === month)?.label ?? "July"
}

export function buildInitialFiscalYear(fiscalYearStart: number, now = new Date()) {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const startYear = currentMonth >= fiscalYearStart ? currentYear : currentYear - 1
  const endYear = startYear + 1

  const startDate = new Date(Date.UTC(startYear, fiscalYearStart - 1, 1))
  const endDate = new Date(Date.UTC(endYear, fiscalYearStart - 1, 0))

  return {
    label: `${startYear}-${endYear}`,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
  }
}

export function buildDefaultPaymentModes(clientId: string): PaymentModeInsert[] {
  return [
    {
      client_id: clientId,
      name: "Cash",
      type: "cash",
      is_active: true,
    },
    {
      client_id: clientId,
      name: "Mutual Bank",
      type: "bank",
      is_active: true,
    },
    {
      client_id: clientId,
      name: "Islami Bank",
      type: "bank",
      is_active: true,
    },
  ]
}
