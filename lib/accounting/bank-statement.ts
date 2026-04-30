import type { SupabaseClient } from "@supabase/supabase-js"

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
  const [{ data: paymentMode }, { data: vouchers }, { data: accountHeads }] = await Promise.all([
    supabase.from("payment_modes").select("*").eq("id", paymentModeId).eq("client_id", clientId).maybeSingle(),
    supabase
      .from("vouchers")
      .select("*")
      .eq("client_id", clientId)
      .eq("fiscal_year_id", fiscalYearId)
      .eq("payment_mode_id", paymentModeId)
      .gte("voucher_date", fromDate)
      .lte("voucher_date", toDate)
      .order("voucher_date", { ascending: true })
      .order("voucher_no", { ascending: true }),
    supabase.from("account_heads").select("*").eq("client_id", clientId),
  ])

  if (!paymentMode) {
    throw new Error("Payment mode not found.")
  }

  const voucherIds = (vouchers ?? []).map((voucher) => voucher.id)
  const { data: entries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] as Database["public"]["Tables"]["voucher_entries"]["Row"][] }

  const voucherMap = new Map((vouchers ?? []).map((voucher) => [voucher.id, voucher]))
  const accountHeadMap = new Map((accountHeads ?? []).map((head) => [head.id, head]))

  const openingBalance = Number(
    (accountHeads ?? []).find((head) => head.name.toLowerCase() === paymentMode.name.toLowerCase())
      ?.opening_balance ?? 0
  )

  const rows = (entries ?? [])
    .map((entry) => {
      const voucher = voucherMap.get(entry.voucher_id ?? "")
      if (!voucher) {
        return null
      }

      return {
        id: entry.id,
        date: voucher.voucher_date,
        voucherNo: voucher.voucher_no,
        accountHead: accountHeadMap.get(entry.account_head_id ?? "")?.name ?? "Unknown",
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

  let running = openingBalance
  const withBalance: BankStatementRow[] = rows.map((row) => {
    running += row.debit - row.credit
    return { ...row, runningBalance: running }
  })

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0)

  return {
    paymentModeName: paymentMode.name,
    openingBalance,
    rows: withBalance,
    totalDebit,
    totalCredit,
    closingBalance: running,
  }
}
