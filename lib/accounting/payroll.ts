import { differenceInMonths, format, lastDayOfMonth, parseISO, startOfMonth } from "date-fns"

import type { AccountGroupType, PayrollComponentKind } from "@/lib/types"

export const PAYROLL_COMPONENTS = {
  basic: { label: "Basic", kind: "earning", mappingCode: "salary_expense" },
  housing: { label: "Housing", kind: "earning", mappingCode: "salary_expense" },
  medical: { label: "Medical", kind: "earning", mappingCode: "salary_expense" },
  conveyance: { label: "Conveyance", kind: "earning", mappingCode: "salary_expense" },
  arrear_salary: { label: "Arrear Salary", kind: "earning", mappingCode: "salary_expense" },
  bonus: { label: "Bonus", kind: "earning", mappingCode: "bonus_expense" },
  employer_pf: { label: "P.F. (Org. Part)", kind: "employer_contribution", mappingCode: "employer_pf_expense" },
  gratuity: { label: "GF", kind: "employer_contribution", mappingCode: "gratuity_expense" },
  staff_pf: { label: "PF (Staff)", kind: "deduction", mappingCode: "pf_payable" },
  pf_total: { label: "PF (Org. + Staff)", kind: "deduction", mappingCode: "pf_payable" },
  loan_installment: { label: "Loan Installment", kind: "deduction", mappingCode: "staff_loan_advance" },
  loan_interest: { label: "Loan Interest", kind: "deduction", mappingCode: "loan_interest_income" },
  tax: { label: "Tax", kind: "deduction", mappingCode: "tax_payable" },
} as const satisfies Record<
  string,
  { label: string; kind: PayrollComponentKind; mappingCode: string }
>

export type PayrollComponentCode = keyof typeof PAYROLL_COMPONENTS

export type PayrollDraftComponent = {
  code: PayrollComponentCode
  amount: number
}

export type PayrollDraftRow = {
  employeeId?: string
  employeeName: string
  designation?: string
  grade?: string
  components: PayrollDraftComponent[]
}

export type PayrollSummary = {
  grossSalary: number
  employerContributions: number
  totalAdditions: number
  totalDeductions: number
  netPayable: number
  subTotal: number  // Basic + Housing + Medical + Conveyance
  totalSalary: number // SubTotal + Additions (PF Org Part, Bonus, Arrear)
}

export const PAYROLL_ACCOUNT_DEFAULTS: Array<{
  mappingCode: string
  headName: string
  groupName: string
  groupType: AccountGroupType
  semiName: string
  subName: string
  balanceType: "debit" | "credit"
}> = [
  {
    mappingCode: "salary_expense",
    headName: "Salary & Benefits",
    groupName: "General & Administrative Expenses",
    groupType: "expense",
    semiName: "Salary & Benefits",
    subName: "Salary & Benefits",
    balanceType: "debit",
  },
  {
    mappingCode: "employer_pf_expense",
    headName: "Employer PF",
    groupName: "General & Administrative Expenses",
    groupType: "expense",
    semiName: "Salary & Benefits",
    subName: "Salary & Benefits",
    balanceType: "debit",
  },
  {
    mappingCode: "gratuity_expense",
    headName: "Gratuity/GF",
    groupName: "General & Administrative Expenses",
    groupType: "expense",
    semiName: "Salary & Benefits",
    subName: "Salary & Benefits",
    balanceType: "debit",
  },
  {
    mappingCode: "bonus_expense",
    headName: "Bonus/Allowance",
    groupName: "General & Administrative Expenses",
    groupType: "expense",
    semiName: "Salary & Benefits",
    subName: "Salary & Benefits",
    balanceType: "debit",
  },
  {
    mappingCode: "salary_payable",
    headName: "Salary Payable",
    groupName: "Current Liabilities",
    groupType: "liability",
    semiName: "Bill Payable",
    subName: "Bill Payable",
    balanceType: "credit",
  },
  {
    mappingCode: "pf_payable",
    headName: "Provident Fund Payable",
    groupName: "Current Liabilities",
    groupType: "liability",
    semiName: "Bill Payable",
    subName: "Bill Payable",
    balanceType: "credit",
  },
  {
    mappingCode: "tax_payable",
    headName: "Tax Payable",
    groupName: "Current Liabilities",
    groupType: "liability",
    semiName: "Provision for Income Tax",
    subName: "Provision for Income Tax",
    balanceType: "credit",
  },
  {
    mappingCode: "staff_loan_advance",
    headName: "Staff Loan/Advance",
    groupName: "Current Assets",
    groupType: "asset",
    semiName: "Advance Deposit & Prepayments",
    subName: "Advance Deposit & Prepayments",
    balanceType: "debit",
  },
  {
    mappingCode: "loan_interest_income",
    headName: "Loan Interest Income",
    groupName: "Non Operation Income",
    groupType: "income",
    semiName: "Non Operation Income",
    subName: "Non Operation Income",
    balanceType: "credit",
  },
]

function amount(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0
}

export function calculatePayrollRowSummary(components: PayrollDraftComponent[]): PayrollSummary & {
  basic: number
  housing: number
  medical: number
  conveyance: number
  subTotal: number
  employerPf: number
  bonus: number
  arrearSalary: number
  totalSalary: number
  pfTotal: number
  loanInstallment: number
  loanInterest: number
  tax: number
} {
  let basic = 0
  let housing = 0
  let medical = 0
  let conveyance = 0
  let employerPf = 0
  let bonus = 0
  let arrearSalary = 0
  let staffPf = 0
  let pfTotal = 0
  let loanInstallment = 0
  let loanInterest = 0
  let tax = 0
  let totalDeductions = 0
  let grossSalary = 0
  let employerContributions = 0

  for (const component of components) {
    const definition = PAYROLL_COMPONENTS[component.code]
    const value = amount(component.amount)

    if (!definition || value <= 0) {
      continue
    }

    if (definition.kind === "earning" || definition.kind === "employer_contribution") {
      grossSalary += value
    }

    if (definition.kind === "employer_contribution") {
      employerContributions += value
    }

    if (definition.kind === "deduction") {
      totalDeductions += value
    }

    if (component.code === "basic") basic = value
    if (component.code === "housing") housing = value
    if (component.code === "medical") medical = value
    if (component.code === "conveyance") conveyance = value
    if (component.code === "employer_pf") employerPf = value
    if (component.code === "bonus") bonus = value
    if (component.code === "arrear_salary") arrearSalary = value
    if (component.code === "staff_pf") staffPf = value
    if (component.code === "pf_total") pfTotal = value
    if (component.code === "loan_installment") loanInstallment = value
    if (component.code === "loan_interest") loanInterest = value
    if (component.code === "tax") tax = value
  }

  // Calculate PF total if not explicitly provided
  if (pfTotal === 0) {
    pfTotal = employerPf + staffPf
  }

  const subTotal = basic + housing + medical + conveyance
  const additions = employerPf + bonus + arrearSalary
  const totalSalary = subTotal + additions
  const totalAdditions = grossSalary

  return {
    grossSalary: amount(grossSalary),
    employerContributions: amount(employerContributions),
    totalAdditions: amount(totalAdditions),
    totalDeductions: amount(totalDeductions),
    netPayable: amount(totalAdditions - totalDeductions),
    subTotal: amount(subTotal),
    totalSalary: amount(totalSalary),
    basic,
    housing,
    medical,
    conveyance,
    employerPf,
    bonus,
    arrearSalary,
    pfTotal,
    loanInstallment,
    loanInterest,
    tax,
  }
}

export function getPayrollRunTotals(rows: PayrollDraftRow[]) {
  return rows.reduce(
    (totals, row) => {
      const summary = calculatePayrollRowSummary(row.components)
      totals.grossSalary += summary.grossSalary
      totals.employerContributions += summary.employerContributions
      totals.totalAdditions += summary.totalAdditions
      totals.totalDeductions += summary.totalDeductions
      totals.netPayable += summary.netPayable
      return totals
    },
    {
      grossSalary: 0,
      employerContributions: 0,
      totalAdditions: 0,
      totalDeductions: 0,
      netPayable: 0,
    }
  )
}

export function getMonthPeriod(monthValue: string) {
  const start = parseISO(`${monthValue}-01`)
  return {
    periodLabel: format(start, "MMM-yyyy"),
    periodStart: format(start, "yyyy-MM-dd"),
    periodEnd: format(lastDayOfMonth(start), "yyyy-MM-dd"),
  }
}

export function getSalaryBillSerialForMonth(fiscalYearStart: string, monthValue: string) {
  const fiscalStart = startOfMonth(parseISO(fiscalYearStart))
  const selectedMonth = startOfMonth(parseISO(`${monthValue}-01`))
  const serial = differenceInMonths(selectedMonth, fiscalStart) + 1

  if (serial < 1 || serial > 12) {
    return null
  }

  return serial
}

export type ParsedSalaryBillRow = PayrollDraftRow & {
  serial?: number
}

export function filterSalaryBillRowsForMonth(
  rows: ParsedSalaryBillRow[],
  fiscalYearStart: string,
  monthValue: string
) {
  const serial = getSalaryBillSerialForMonth(fiscalYearStart, monthValue)
  if (!serial) {
    return { rows: [] as PayrollDraftRow[], mode: "out_of_range" as const, serial: null }
  }

  const rowsWithSerial = rows.filter((row) => typeof row.serial === "number")
  if (!rowsWithSerial.length) {
    return { rows, mode: "single_month" as const, serial: null }
  }

  const maxSerial = Math.max(...rowsWithSerial.map((row) => row.serial ?? 0))
  if (maxSerial <= 1) {
    return { rows: rows.map(({ serial: _serial, ...row }) => row), mode: "single_month" as const, serial: null }
  }

  const filtered = rowsWithSerial
    .filter((row) => row.serial === serial)
    .map(({ serial: _serial, ...row }) => row)

  return { rows: filtered, mode: "yearly_bill" as const, serial }
}

export function normalizePayrollRows(rows: PayrollDraftRow[]) {
  return rows
    .map((row) => ({
      ...row,
      employeeName: row.employeeName.trim(),
      designation: row.designation?.trim() || undefined,
      grade: row.grade?.trim() || undefined,
      components: row.components
        .map((component) => ({
          code: component.code,
          amount: amount(component.amount),
        }))
        .filter((component) => component.amount > 0),
    }))
    .filter((row) => row.employeeName && row.components.length)
}
