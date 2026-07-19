import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveMappedPaymentModeAccount, type PaymentModeAccountHead } from "@/lib/accounting/payment-modes"
import type { Database } from "@/lib/types"

export type BankStatementRow = {
  id: string
  date: string
  voucherNo: number
  accountHead: string
  description: string
  debit: number
  credit: number
  runningBalance: number
}

export type BankStatementResult = {
  paymentModeName: string
  openingBalance: number
  rows: BankStatementRow[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

type VoucherRow = Pick<
  Database["public"]["Tables"]["vouchers"]["Row"],
  "id" | "voucher_date" | "voucher_no" | "description"
>

type VoucherEntryRow = Pick<
  Database["public"]["Tables"]["voucher_entries"]["Row"],
  "id" | "voucher_id" | "account_head_id" | "debit" | "credit" | "description"
>

type AccountHeadRow = Pick<
  Database["public"]["Tables"]["account_heads"]["Row"],
  "id" | "client_id" | "name" | "opening_balance" | "balance_type" | "is_active"
>

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseStrictDate(value: string) {
  const match = DATE_ONLY_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const normalized = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)

  return normalized === value ? normalized : null
}

function normalizeDbDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const strict = parseStrictDate(value)
  if (strict) {
    return strict
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function applyLedgerMovement({
  startingBalance,
  balanceType,
  debit,
  credit,
}: {
  startingBalance: number
  balanceType: string | null | undefined
  debit: number
  credit: number
}) {
  if ((balanceType ?? "debit") === "credit") {
    return startingBalance + credit - debit
  }

  return startingBalance + debit - credit
}

export function buildBankStatementResult({
  paymentModeName,
  accountHead,
  vouchers,
  entries,
  fromDate,
  toDate,
}: {
  paymentModeName: string
  accountHead: AccountHeadRow
  vouchers: VoucherRow[]
  entries: VoucherEntryRow[]
  fromDate: string
  toDate: string
}): BankStatementResult {
  const normalizedFromDate = parseStrictDate(fromDate)
  const normalizedToDate = parseStrictDate(toDate)

  if (!normalizedFromDate || !normalizedToDate) {
    throw new Error("Invalid report date range.")
  }

  if (normalizedFromDate > normalizedToDate) {
    throw new Error("Report start date cannot be after the end date.")
  }

  const voucherMap = new Map(
    vouchers
      .map((voucher) => {
        const normalizedDate = normalizeDbDate(voucher.voucher_date)
        return normalizedDate ? [voucher.id, { ...voucher, voucher_date: normalizedDate }] : null
      })
      .filter((item): item is [string, VoucherRow] => Boolean(item))
  )

  const selectedEntries = entries
    .filter((entry) => entry.account_head_id === accountHead.id)
    .map((entry) => {
      const voucher = voucherMap.get(entry.voucher_id ?? "")
      if (!voucher) {
        return null
      }

      return {
        id: entry.id,
        date: voucher.voucher_date,
        voucherNo: voucher.voucher_no,
        accountHead: accountHead.name,
        description: entry.description || voucher.description || "",
        debit: Number(entry.debit ?? 0),
        credit: Number(entry.credit ?? 0),
      }
    })
    .filter((row): row is Omit<BankStatementRow, "runningBalance"> => Boolean(row))
    .sort((left, right) => {
      if (left.date === right.date) {
        return left.voucherNo - right.voucherNo
      }

      return left.date.localeCompare(right.date)
    })

  let openingBalance = Number(accountHead.opening_balance ?? 0)

  for (const entry of selectedEntries) {
    if (entry.date < normalizedFromDate) {
      openingBalance = applyLedgerMovement({
        startingBalance: openingBalance,
        balanceType: accountHead.balance_type,
        debit: entry.debit,
        credit: entry.credit,
      })
    }
  }

  const rowsInRange = selectedEntries.filter(
    (entry) => entry.date >= normalizedFromDate && entry.date <= normalizedToDate
  )

  let runningBalance = openingBalance
  const rows = rowsInRange.map((row) => {
    runningBalance = applyLedgerMovement({
      startingBalance: runningBalance,
      balanceType: accountHead.balance_type,
      debit: row.debit,
      credit: row.credit,
    })

    return {
      ...row,
      runningBalance,
    }
  })

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0)

  return {
    paymentModeName,
    openingBalance,
    rows,
    totalDebit,
    totalCredit,
    closingBalance: runningBalance,
  }
}

export async function calculateBankStatement(
  supabase: SupabaseClient<Database>,
  {
    clientId,
    fiscalYearId,
    paymentModeId,
    fromDate,
    toDate,
  }: {
    clientId: string
    fiscalYearId: string
    paymentModeId: string
    fromDate: string
    toDate: string
  }
): Promise<BankStatementResult> {
  const normalizedFromDate = parseStrictDate(fromDate)
  const normalizedToDate = parseStrictDate(toDate)

  if (!normalizedFromDate || !normalizedToDate) {
    throw new Error("Invalid report date range.")
  }

  if (normalizedFromDate > normalizedToDate) {
    throw new Error("Report start date cannot be after the end date.")
  }

  const [{ data: paymentMode }, { data: fiscalYear }, { data: accountHeads }] = await Promise.all([
    supabase.from("payment_modes").select("*").eq("id", paymentModeId).eq("client_id", clientId).maybeSingle(),
    supabase.from("fiscal_years").select("*").eq("id", fiscalYearId).eq("client_id", clientId).maybeSingle(),
    supabase.from("account_heads").select("*").eq("client_id", clientId),
  ])

  if (!paymentMode) {
    throw new Error("Payment mode not found.")
  }

  if (!fiscalYear) {
    throw new Error("Fiscal year not found.")
  }

  const fiscalYearStart = normalizeDbDate(fiscalYear.start_date)
  const fiscalYearEnd = normalizeDbDate(fiscalYear.end_date)

  if (!fiscalYearStart || !fiscalYearEnd) {
    throw new Error("Fiscal year has invalid date boundaries.")
  }

  if (normalizedFromDate < fiscalYearStart || normalizedToDate > fiscalYearEnd) {
    throw new Error("Bank statement date range must stay within the selected fiscal year.")
  }

  const mappedAccountHead = resolveMappedPaymentModeAccount({
    clientId,
    paymentMode,
    accountHeads: ((accountHeads ?? []) as PaymentModeAccountHead[]),
  })

  if (!mappedAccountHead.ok) {
    throw new Error(mappedAccountHead.error)
  }

  const accountHead = (accountHeads ?? []).find((head) => head.id === mappedAccountHead.accountHead.id) ?? null

  if (!accountHead) {
    throw new Error("The selected payment mode is not mapped to an active same-client cash or bank asset account.")
  }

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("id, voucher_date, voucher_no, description")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .or("is_posted.eq.true,is_posted.is.null")
    .lte("voucher_date", normalizedToDate)
    .order("voucher_date", { ascending: true })
    .order("voucher_no", { ascending: true })

  const voucherIds = (vouchers ?? []).map((voucher) => voucher.id)
  const { data: entries } = voucherIds.length
    ? await supabase
        .from("voucher_entries")
        .select("id, voucher_id, account_head_id, debit, credit, description")
        .in("voucher_id", voucherIds)
        .eq("account_head_id", accountHead.id)
    : { data: [] as VoucherEntryRow[] }

  return buildBankStatementResult({
    paymentModeName: paymentMode.name,
    accountHead: {
      id: accountHead.id,
      client_id: accountHead.client_id,
      name: accountHead.name,
      opening_balance: accountHead.opening_balance,
      balance_type: accountHead.balance_type,
      is_active: accountHead.is_active,
    },
    vouchers: (vouchers ?? []) as VoucherRow[],
    entries: (entries ?? []) as VoucherEntryRow[],
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
  })
}
