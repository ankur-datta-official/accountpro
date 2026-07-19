import type { AccountGroupType, PayrollComponentKind, PayrollRunStatus } from "@/lib/types"

export type PayrollMutationOperation =
  | "create"
  | "edit"
  | "delete"
  | "rerun"
  | "post-accrual"
  | "post-payment"

export type PayrollPostingComponent = {
  mappingCode: string
  kind: PayrollComponentKind
  amount: number
}

export type PayrollResolvedEmployee = {
  id: string
  clientId: string
  isActive: boolean | null
}

export type PayrollPostingMapping = {
  accountHeadId: string
  accountsGroup: AccountGroupType
}

export type PayrollPostingLine = {
  accountsGroup: AccountGroupType
  accountHeadId: string
  debitAmount: number
  creditAmount: number
  description: string
}

export type PayrollPostingAccountHead = {
  id: string
  clientId: string | null
  isActive: boolean | null
  type: string | null
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function isDraftLike(status: PayrollRunStatus | string | null | undefined) {
  return status === "draft" || status === "reviewed"
}

function normalizeDateOnly(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const strict = DATE_ONLY_PATTERN.exec(value)
  if (strict) {
    return value
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

export function validatePayrollLifecycle({
  operation,
  status,
  isFiscalYearClosed,
  accrualVoucherId,
  paymentVoucherId,
}: {
  operation: PayrollMutationOperation
  status: PayrollRunStatus | string | null | undefined
  isFiscalYearClosed: boolean | null | undefined
  accrualVoucherId?: string | null
  paymentVoucherId?: string | null
}) {
  if (isFiscalYearClosed) {
    return {
      ok: false as const,
      error: "Closed fiscal-year payroll is immutable.",
    }
  }

  if (paymentVoucherId || status === "paid") {
    if (operation === "post-payment") {
      return {
        ok: false as const,
        error: "Payroll salary payment has already been posted.",
      }
    }

    return {
      ok: false as const,
      error: "Paid payroll runs are locked and cannot be changed.",
    }
  }

  if (operation === "post-payment") {
    if (status !== "posted" || !accrualVoucherId) {
      return {
        ok: false as const,
        error: "Post payroll accrual before salary payment.",
      }
    }

    return { ok: true as const }
  }

  if (operation === "post-accrual") {
  if (accrualVoucherId || status === "posted") {
      return {
        ok: false as const,
        error: "Payroll accrual has already been posted.",
      }
    }

    if (!isDraftLike(status)) {
      return {
        ok: false as const,
        error: "Only draft payroll runs can be posted.",
      }
    }

    return { ok: true as const }
  }

  if (!isDraftLike(status) || accrualVoucherId || paymentVoucherId) {
    return {
      ok: false as const,
      error: "Posted payroll runs are locked. Create an adjustment run instead.",
    }
  }

  return { ok: true as const }
}

export function validatePayrollPeriodWithinFiscalYear({
  periodStart,
  periodEnd,
  fiscalYearStart,
  fiscalYearEnd,
}: {
  periodStart: string
  periodEnd: string
  fiscalYearStart: string | null | undefined
  fiscalYearEnd: string | null | undefined
}) {
  const normalizedPeriodStart = normalizeDateOnly(periodStart)
  const normalizedPeriodEnd = normalizeDateOnly(periodEnd)
  const normalizedFiscalYearStart = normalizeDateOnly(fiscalYearStart)
  const normalizedFiscalYearEnd = normalizeDateOnly(fiscalYearEnd)

  if (!normalizedPeriodStart || !normalizedPeriodEnd || !normalizedFiscalYearStart || !normalizedFiscalYearEnd) {
    return {
      ok: false as const,
      error: "The payroll period or fiscal year boundaries are invalid.",
    }
  }

  if (normalizedPeriodStart < normalizedFiscalYearStart || normalizedPeriodEnd > normalizedFiscalYearEnd) {
    return {
      ok: false as const,
      error: "Payroll period must stay within the selected fiscal year.",
    }
  }

  return { ok: true as const }
}

export function validateResolvedPayrollEmployees({
  expectedClientId,
  employees,
}: {
  expectedClientId: string
  employees: PayrollResolvedEmployee[]
}) {
  for (const employee of employees) {
    if (employee.clientId !== expectedClientId || employee.isActive === false) {
      return {
        ok: false as const,
        error: "Payroll rows must reference active employees from the same client.",
      }
    }
  }

  return { ok: true as const }
}

export function validateDuplicatePayrollRun(hasExistingRun: boolean) {
  if (hasExistingRun) {
    return {
      ok: false as const,
      error: "A payroll run already exists for this period.",
    }
  }

  return { ok: true as const }
}

export function buildPayrollAccrualVoucherLines({
  components,
  netPayable,
  mappingsByCode,
  periodLabel,
}: {
  components: PayrollPostingComponent[]
  netPayable: number
  mappingsByCode: Record<string, PayrollPostingMapping | undefined>
  periodLabel: string
}) {
  const debitByMapping = new Map<string, number>()
  const creditByMapping = new Map<string, number>()
  const missingMappings = new Set<string>()

  for (const component of components) {
    const amount = roundMoney(Number(component.amount ?? 0))
    if (amount <= 0) {
      continue
    }

    if (component.kind === "deduction") {
      if (!mappingsByCode[component.mappingCode]) {
        missingMappings.add(component.mappingCode)
      }
      creditByMapping.set(component.mappingCode, roundMoney((creditByMapping.get(component.mappingCode) ?? 0) + amount))
    } else {
      if (!mappingsByCode[component.mappingCode]) {
        missingMappings.add(component.mappingCode)
      }
      debitByMapping.set(component.mappingCode, roundMoney((debitByMapping.get(component.mappingCode) ?? 0) + amount))
    }
  }

  if (!mappingsByCode.salary_payable) {
    missingMappings.add("salary_payable")
  }

  if (missingMappings.size) {
    return {
      ok: false as const,
      error: "Payroll account mappings are incomplete for one or more accrual lines.",
    }
  }

  creditByMapping.set("salary_payable", roundMoney((creditByMapping.get("salary_payable") ?? 0) + roundMoney(netPayable)))

  const lines: PayrollPostingLine[] = [
    ...Array.from(debitByMapping.entries()).map(([mappingCode, amount]) => {
      const mapping = mappingsByCode[mappingCode]
      return mapping
        ? {
            accountsGroup: mapping.accountsGroup,
            accountHeadId: mapping.accountHeadId,
            debitAmount: amount,
            creditAmount: 0,
            description: `Payroll ${mappingCode.replace(/_/g, " ")} for ${periodLabel}`,
          }
        : null
    }),
    ...Array.from(creditByMapping.entries()).map(([mappingCode, amount]) => {
      const mapping = mappingsByCode[mappingCode]
      return mapping
        ? {
            accountsGroup: mapping.accountsGroup,
            accountHeadId: mapping.accountHeadId,
            debitAmount: 0,
            creditAmount: amount,
            description: `Payroll ${mappingCode.replace(/_/g, " ")} for ${periodLabel}`,
          }
        : null
    }),
  ].filter((line): line is PayrollPostingLine => Boolean(line))

  const totalDebit = roundMoney(lines.reduce((sum, line) => sum + line.debitAmount, 0))
  const totalCredit = roundMoney(lines.reduce((sum, line) => sum + line.creditAmount, 0))

  if (!lines.length) {
    return {
      ok: false as const,
      error: "Payroll accrual cannot be posted without mapped accounting amounts.",
    }
  }

  if (totalDebit !== totalCredit) {
    return {
      ok: false as const,
      error: "Payroll accrual voucher is not balanced.",
    }
  }

  return {
    ok: true as const,
    lines,
    totalDebit,
    totalCredit,
  }
}

export function buildPayrollPaymentVoucherLines({
  salaryPayableHeadId,
  paymentAccountHeadId,
  amount,
  periodLabel,
}: {
  salaryPayableHeadId: string
  paymentAccountHeadId: string
  amount: number
  periodLabel: string
}) {
  const normalizedAmount = roundMoney(Number(amount ?? 0))

  if (!salaryPayableHeadId || !paymentAccountHeadId || normalizedAmount <= 0) {
    return {
      ok: false as const,
      error: "No payable salary amount found for this payroll run.",
    }
  }

  return {
    ok: true as const,
    lines: [
      {
        accountsGroup: "liability" as const,
        accountHeadId: salaryPayableHeadId,
        debitAmount: normalizedAmount,
        creditAmount: 0,
        description: `Salary payable settled for ${periodLabel}`,
      },
      {
        accountsGroup: "asset" as const,
        accountHeadId: paymentAccountHeadId,
        debitAmount: 0,
        creditAmount: normalizedAmount,
        description: `Payroll cash or bank payment for ${periodLabel}`,
      },
    ],
    totalDebit: normalizedAmount,
    totalCredit: normalizedAmount,
  }
}

export function validatePaymentAccountHead({
  clientId,
  accountHead,
}: {
  clientId: string
  accountHead: PayrollPostingAccountHead | null
}) {
  if (!accountHead) {
    return {
      ok: false as const,
      error: "The selected payment mode is not linked to an active same-client cash or bank account.",
    }
  }

  if (accountHead.clientId !== clientId || accountHead.isActive === false || accountHead.type !== "asset") {
    return {
      ok: false as const,
      error: "The selected payment mode is not linked to an active same-client cash or bank account.",
    }
  }

  return { ok: true as const }
}

export async function runPayrollCompensatingAction<T>({
  perform,
  rollback,
  rollbackFailureMessage,
}: {
  perform: () => Promise<T>
  rollback: () => Promise<boolean>
  rollbackFailureMessage: string
}) {
  try {
    return {
      ok: true as const,
      value: await perform(),
    }
  } catch (error) {
    const rolledBack = await rollback()
    return {
      ok: false as const,
      error: rolledBack
        ? error instanceof Error && error.message
          ? error.message
          : "Payroll operation failed."
        : rollbackFailureMessage,
    }
  }
}
