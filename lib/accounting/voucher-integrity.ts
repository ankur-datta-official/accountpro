export type VoucherIntegrityVoucherType =
  | "payment"
  | "received"
  | "journal"
  | "contra"
  | "bf"
  | "bp"
  | "br"

export type VoucherIntegrityAccountsGroup = "expense" | "income" | "asset" | "liability"

export type VoucherIntegrityLine = {
  accountHeadId: string
  accountsGroup: VoucherIntegrityAccountsGroup
  debitAmount: unknown
  creditAmount: unknown
}

export type VoucherIntegrityAccountHead = {
  id: string
  client_id: string | null
  sub_group_id: string | null
  is_active: boolean | null
  type?: string | null
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MINOR_UNITS_FACTOR = 100
const MINOR_UNITS_TOLERANCE = 1e-6

function parseStrictDateOnly(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const utcDate = new Date(Date.UTC(year, month - 1, day))

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return value
}

function formatDateOnlyFromUnknown(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    const strict = parseStrictDateOnly(value)
    if (strict) {
      return strict
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }

    return parsed.toISOString().slice(0, 10)
  }

  if (Number.isNaN(value.getTime())) {
    return null
  }

  return value.toISOString().slice(0, 10)
}

function toMinorUnits(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }

  const scaled = value * MINOR_UNITS_FACTOR
  const rounded = Math.round(scaled)

  if (Math.abs(scaled - rounded) > MINOR_UNITS_TOLERANCE) {
    return null
  }

  return rounded
}

export function validateVoucherDateInFiscalYear({
  expectedClientId,
  fiscalYearClientId,
  voucherDate,
  fiscalYearStart,
  fiscalYearEnd,
}: {
  expectedClientId: string
  fiscalYearClientId: string | null | undefined
  voucherDate: string
  fiscalYearStart: string | Date | null | undefined
  fiscalYearEnd: string | Date | null | undefined
}) {
  const normalizedVoucherDate = parseStrictDateOnly(voucherDate)

  if (!normalizedVoucherDate) {
    return {
      ok: false as const,
      error: "Voucher date must be a valid YYYY-MM-DD value.",
    }
  }

  if (fiscalYearClientId && fiscalYearClientId !== expectedClientId) {
    return {
      ok: false as const,
      error: "Fiscal year not found.",
    }
  }

  const normalizedStart = formatDateOnlyFromUnknown(fiscalYearStart)
  const normalizedEnd = formatDateOnlyFromUnknown(fiscalYearEnd)

  if (!normalizedStart || !normalizedEnd) {
    return {
      ok: false as const,
      error: "The selected fiscal year has invalid date boundaries.",
    }
  }

  if (normalizedVoucherDate < normalizedStart) {
    return {
      ok: false as const,
      error: "Voucher date cannot be before the selected fiscal year start date.",
    }
  }

  if (normalizedVoucherDate > normalizedEnd) {
    return {
      ok: false as const,
      error: "Voucher date cannot be after the selected fiscal year end date.",
    }
  }

  return {
    ok: true as const,
    voucherDate: normalizedVoucherDate,
    fiscalYearStart: normalizedStart,
    fiscalYearEnd: normalizedEnd,
  }
}

export function validateVoucherLines(
  lines: VoucherIntegrityLine[],
  voucherType: VoucherIntegrityVoucherType
) {
  if (!lines.length) {
    return {
      ok: false as const,
      error: "At least one voucher line is required.",
    }
  }

  let totalDebitMinor = 0
  let totalCreditMinor = 0

  for (const line of lines) {
    if (!line.accountHeadId) {
      return {
        ok: false as const,
        error: "Each voucher line must reference an account head.",
      }
    }

    const debitMinor = toMinorUnits(line.debitAmount)
    const creditMinor = toMinorUnits(line.creditAmount)

    if (debitMinor === null || creditMinor === null) {
      return {
        ok: false as const,
        error: "Voucher amounts must be finite positive numbers with at most two decimal places.",
      }
    }

    if (debitMinor > 0 && creditMinor > 0) {
      return {
        ok: false as const,
        error: "Each voucher line must contain either a debit or a credit amount, not both.",
      }
    }

    if (debitMinor === 0 && creditMinor === 0) {
      return {
        ok: false as const,
        error: "Each voucher line must contain a non-zero debit or credit amount.",
      }
    }

    totalDebitMinor += debitMinor
    totalCreditMinor += creditMinor
  }

  if (totalDebitMinor === 0 && totalCreditMinor === 0) {
    return {
      ok: false as const,
      error: "Zero-value vouchers are not allowed.",
    }
  }

  const differenceMinor = totalDebitMinor - totalCreditMinor
  const isBalanced = differenceMinor === 0
  const hasOnlyDebits = totalDebitMinor > 0 && totalCreditMinor === 0
  const hasOnlyCredits = totalCreditMinor > 0 && totalDebitMinor === 0
  const requiresAutoBalance =
    !isBalanced &&
    ((voucherType === "payment" && hasOnlyDebits) ||
      (voucherType === "received" && hasOnlyCredits))

  if (!isBalanced && !requiresAutoBalance) {
    return {
      ok: false as const,
      error: "Total debit and total credit must be balanced.",
    }
  }

  if (!isBalanced && (voucherType === "payment" || voucherType === "received")) {
    const invalidDirection =
      (voucherType === "payment" && !hasOnlyDebits) ||
      (voucherType === "received" && !hasOnlyCredits)

    if (invalidDirection) {
      return {
        ok: false as const,
        error:
          "Payment and received vouchers may auto-balance only when the entered lines contain one clear accounting side.",
      }
    }
  }

  if (!isBalanced && requiresAutoBalance) {
    return {
      ok: true as const,
      totalDebitMinor,
      totalCreditMinor,
      differenceMinor,
      requiresAutoBalance: true,
      autoBalanceSide: voucherType === "payment" ? ("credit" as const) : ("debit" as const),
    }
  }

  return {
    ok: true as const,
    totalDebitMinor,
    totalCreditMinor,
    differenceMinor,
    requiresAutoBalance: false,
    autoBalanceSide: null,
  }
}

export function validateVoucherAccountHeads({
  clientId,
  lines,
  accountHeads,
}: {
  clientId: string
  lines: VoucherIntegrityLine[]
  accountHeads: VoucherIntegrityAccountHead[]
}) {
  const headsById = new Map(accountHeads.map((head) => [head.id, head]))

  for (const line of lines) {
    const accountHead = headsById.get(line.accountHeadId)

    if (!accountHead) {
      return {
        ok: false as const,
        error: "One or more voucher account heads are invalid or unavailable for posting.",
      }
    }

    if (accountHead.client_id !== clientId || accountHead.is_active === false || !accountHead.sub_group_id) {
      return {
        ok: false as const,
        error: "One or more voucher account heads are invalid or unavailable for posting.",
      }
    }
  }

  return {
    ok: true as const,
  }
}

export function validateVoucherMutationPolicy({
  operation,
  isPosted,
  isFiscalYearClosed,
  requestedCount = 1,
  matchedCount = 1,
}: {
  operation: "update" | "delete" | "bulk-delete"
  isPosted: boolean | null | undefined
  isFiscalYearClosed: boolean | null | undefined
  requestedCount?: number
  matchedCount?: number
}) {
  if (operation === "bulk-delete" && requestedCount !== matchedCount) {
    return {
      ok: false as const,
      error: "Bulk delete requires an exact voucher match and will not partially delete records.",
    }
  }

  if (isFiscalYearClosed) {
    return {
      ok: false as const,
      error: "Closed fiscal-year vouchers are immutable.",
    }
  }

  if (isPosted !== false) {
    return {
      ok: false as const,
      error:
        operation === "update"
          ? "Posted vouchers cannot be edited directly. Create a reversal flow before changing posted history."
          : "Posted vouchers cannot be deleted directly.",
    }
  }

  return {
    ok: true as const,
  }
}

export async function runAtomicVoucherOperation<T>({
  perform,
  rollback,
  failureMessage,
  rollbackFailureMessage,
}: {
  perform: () => Promise<T>
  rollback: () => Promise<boolean>
  failureMessage: string
  rollbackFailureMessage: string
}) {
  try {
    const value = await perform()
    return {
      ok: true as const,
      value,
    }
  } catch (error) {
    const rolledBack = await rollback()

    return {
      ok: false as const,
      error: rolledBack
        ? error instanceof Error && error.message
          ? error.message
          : failureMessage
        : rollbackFailureMessage,
    }
  }
}
