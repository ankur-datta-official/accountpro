import { addMonths, format, parseISO } from "date-fns"

import type { SalaryCertificateStatus } from "@/lib/types"

export type SalaryCertificateOperation = "generate" | "issue" | "cancel"

export type SalaryCertificateComponent = {
  code: string
  amount: number | null | undefined
}

export type SalaryCertificateRunItem = {
  employeeId: string | null
  employeeName: string
  designation: string | null
  components: SalaryCertificateComponent[]
}

export type SalaryCertificateRun = {
  id: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  paymentVoucherNo?: number | null
  paymentVoucherDate?: string | null
  paymentModeName?: string | null
  items: SalaryCertificateRunItem[]
}

export type SalaryCertificateTaxRow = {
  challanDate: string
  challanNo: string
  bankName: string
  branchName: string
  employeeTds: number
}

export type SalaryCertificateSnapshot = {
  certificateNo: string
  issueDate: string
  generatedAt: string
  client: {
    id: string
    name: string
    tradeName: string | null
    address: string | null
    phone: string | null
    email: string | null
    tin: string | null
    bin: string | null
  }
  fiscalYear: {
    id: string
    label: string
    startDate: string
    endDate: string
    assessmentYearLabel: string
  }
  employee: {
    id: string | null
    employeeCode: string | null
    name: string
    designation: string | null
    joiningDate: string | null
  }
  salary: {
    basic: number
    houseRent: number
    medical: number
    conveyance: number
    otherAllowance: number
    gross: number
    taxDeduction: number
    otherDeduction: number
    netSalary: number
  }
  tax: {
    employeeTds: number
    records: SalaryCertificateTaxRow[]
  }
  payrollCoverage: {
    expectedMonths: string[]
    coveredMonths: string[]
    missingMonths: string[]
  }
}

export type AnnualAggregationInput = {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  designation: string | null
  joiningDate: string | null
  fiscalYearLabel: string
  fiscalYearStart: string
  fiscalYearEnd: string
  runs: SalaryCertificateRun[]
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2))
}

function getComponentAmount(components: SalaryCertificateComponent[], code: string) {
  const match = components.find((component) => component.code === code)
  return roundMoney(Number(match?.amount ?? 0))
}

function getMonthKey(dateValue: string) {
  return format(parseISO(dateValue), "yyyy-MM")
}

export function getFiscalYearMonthKeys(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const months: string[] = []
  let current = start

  while (current <= end) {
    months.push(format(current, "yyyy-MM"))
    current = addMonths(current, 1)
  }

  return months
}

export function buildAssessmentYearLabel(fiscalYearLabel: string) {
  const match = fiscalYearLabel.match(/(\d{4})\D+(\d{4})/)
  if (!match) {
    return fiscalYearLabel
  }

  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
}

export function buildSalaryCertificateNumber({
  fiscalYearLabel,
  sequence,
}: {
  fiscalYearLabel: string
  sequence: number
}) {
  const runningNumber = String(sequence).padStart(3, "0")
  return `SAL/${fiscalYearLabel}/${runningNumber}`
}

export function validateSalaryCertificateLifecycle({
  operation,
  status,
  isFiscalYearClosed,
}: {
  operation: SalaryCertificateOperation
  status: SalaryCertificateStatus | null | undefined
  isFiscalYearClosed: boolean | null | undefined
}) {
  if (isFiscalYearClosed) {
    return {
      ok: false as const,
      error: "Closed fiscal-year certificates are immutable.",
    }
  }

  if (!status) {
    return { ok: true as const }
  }

  if (status === "cancelled") {
    return {
      ok: false as const,
      error: "Cancelled certificates cannot be changed.",
    }
  }

  if (status === "issued") {
    return {
      ok: false as const,
      error: "Issued certificates are immutable.",
    }
  }

  if (operation === "cancel" || operation === "generate" || operation === "issue") {
    return { ok: true as const }
  }

  return { ok: true as const }
}

export function aggregateAnnualPayroll(input: AnnualAggregationInput) {
  const expectedMonths = getFiscalYearMonthKeys(input.fiscalYearStart, input.fiscalYearEnd)
  const coveredMonths = new Set<string>()

  let basic = 0
  let houseRent = 0
  let medical = 0
  let conveyance = 0
  let otherAllowance = 0
  let taxDeduction = 0
  let otherDeduction = 0

  const taxRows: SalaryCertificateTaxRow[] = []
  let resolvedEmployeeName = input.employeeName
  let resolvedDesignation = input.designation

  for (const run of input.runs) {
    const item = run.items.find((candidate) => candidate.employeeId === input.employeeId)
    if (!item) {
      continue
    }

    coveredMonths.add(getMonthKey(run.periodStart))
    resolvedEmployeeName = item.employeeName || resolvedEmployeeName
    resolvedDesignation = item.designation || resolvedDesignation

    const rowBasic = getComponentAmount(item.components, "basic")
    const rowHouseRent = getComponentAmount(item.components, "housing")
    const rowMedical = getComponentAmount(item.components, "medical")
    const rowConveyance = getComponentAmount(item.components, "conveyance")
    const rowTax = getComponentAmount(item.components, "tax")

    const knownAllowances = new Set(["basic", "housing", "medical", "conveyance"])
    const knownDeductions = new Set(["tax"])

    let rowOtherAllowance = 0
    let rowOtherDeduction = 0

    for (const component of item.components) {
      const amount = roundMoney(Number(component.amount ?? 0))
      if (amount <= 0) {
        continue
      }

      if (knownAllowances.has(component.code) || knownDeductions.has(component.code)) {
        continue
      }

      if (["staff_pf", "pf_total", "loan_installment", "loan_interest"].includes(component.code)) {
        rowOtherDeduction += amount
        continue
      }

      if (["employer_pf", "gratuity"].includes(component.code)) {
        continue
      }

      rowOtherAllowance += amount
    }

    basic += rowBasic
    houseRent += rowHouseRent
    medical += rowMedical
    conveyance += rowConveyance
    otherAllowance += rowOtherAllowance
    taxDeduction += rowTax
    otherDeduction += rowOtherDeduction

    if (rowTax > 0) {
      taxRows.push({
        challanDate: run.paymentVoucherDate ?? run.periodEnd,
        challanNo: run.paymentVoucherNo ? String(run.paymentVoucherNo) : run.periodLabel,
        bankName: run.paymentModeName ?? "",
        branchName: "",
        employeeTds: rowTax,
      })
    }
  }

  const missingMonths = expectedMonths.filter((month) => !coveredMonths.has(month))
  const gross = basic + houseRent + medical + conveyance + otherAllowance
  const netSalary = gross - taxDeduction - otherDeduction

  if (coveredMonths.size === 0) {
    return {
      ok: false as const,
      error: "No payroll data found for the selected employee in this fiscal year.",
      missingMonths: expectedMonths,
    }
  }

  return {
    ok: true as const,
    snapshotPayload: {
      employeeName: resolvedEmployeeName,
      designation: resolvedDesignation,
      salary: {
        basic: roundMoney(basic),
        houseRent: roundMoney(houseRent),
        medical: roundMoney(medical),
        conveyance: roundMoney(conveyance),
        otherAllowance: roundMoney(otherAllowance),
        gross: roundMoney(gross),
        taxDeduction: roundMoney(taxDeduction),
        otherDeduction: roundMoney(otherDeduction),
        netSalary: roundMoney(netSalary),
      },
      tax: {
        employeeTds: roundMoney(taxDeduction),
        records: taxRows,
      },
      payrollCoverage: {
        expectedMonths,
        coveredMonths: Array.from(coveredMonths).sort(),
        missingMonths,
      },
    },
  }
}
