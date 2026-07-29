import { openingBalanceToSignedAmount } from "@/lib/accounting/ledger"
import type { Database } from "@/lib/types"

type PaymentModeRow = Database["public"]["Tables"]["payment_modes"]["Row"]
type AccountHeadRow = Database["public"]["Tables"]["account_heads"]["Row"]
type VoucherEntryRow = Database["public"]["Tables"]["voucher_entries"]["Row"]

type QueryResult<T> = PromiseLike<{
  data: T[] | null
  error: { message?: string } | null
}>

type FilterableQuery<T> = QueryResult<T> & {
  eq: (column: string, value: string) => FilterableQuery<T>
  in: (column: string, values: string[]) => FilterableQuery<T>
  lte: (column: string, value: string) => FilterableQuery<T>
  neq: (column: string, value: string) => FilterableQuery<T>
}

type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => FilterableQuery<Record<string, unknown>>
  }
}

export type PaymentModeFundingSnapshot = {
  paymentModeId: string
  paymentModeName: string
  paymentModeType: string | null
  accountHeadId: string | null
  currentBalance: number | null
  isMapped: boolean
}

export async function getPaymentModeFundingSnapshot({
  supabase,
  clientId,
  voucherDate,
  paymentModeIds,
  excludeVoucherId,
}: {
  supabase: SupabaseLike
  clientId: string
  voucherDate: string
  paymentModeIds: string[]
  excludeVoucherId?: string
}) {
  const uniquePaymentModeIds = Array.from(new Set(paymentModeIds.filter(Boolean)))

  if (!uniquePaymentModeIds.length) {
    return []
  }

  const { data: paymentModes, error: paymentModesError } = await supabase
    .from("payment_modes")
    .select("id, name, type, account_head_id, client_id")
    .eq("client_id", clientId)
    .in("id", uniquePaymentModeIds)

  if (paymentModesError) {
    throw new Error(paymentModesError.message ?? "Unable to load payment mode balances.")
  }

  const paymentModeRows = (paymentModes ?? []) as Array<
    Pick<PaymentModeRow, "id" | "name" | "type" | "account_head_id" | "client_id">
  >

  const linkedAccountHeadIds = Array.from(
    new Set(paymentModeRows.map((mode) => mode.account_head_id).filter(Boolean) as string[])
  )

  if (!linkedAccountHeadIds.length) {
    return paymentModeRows.map((mode) => ({
      paymentModeId: mode.id,
      paymentModeName: mode.name,
      paymentModeType: mode.type,
      accountHeadId: mode.account_head_id,
      currentBalance: null,
      isMapped: false,
    }))
  }

  const [{ data: accountHeads, error: accountHeadsError }, historicalEntriesResult] = await Promise.all([
    supabase
      .from("account_heads")
      .select("id, opening_balance, balance_type, type, client_id")
      .eq("client_id", clientId)
      .in("id", linkedAccountHeadIds),
    (() => {
      let query = supabase
        .from("voucher_entries")
        .select("voucher_id, account_head_id, debit, credit, vouchers!inner(client_id, voucher_date)")
        .in("account_head_id", linkedAccountHeadIds)
        .eq("vouchers.client_id", clientId)
        .lte("vouchers.voucher_date", voucherDate)

      if (excludeVoucherId) {
        query = query.neq("voucher_id", excludeVoucherId)
      }

      return query
    })(),
  ])

  if (accountHeadsError) {
    throw new Error(accountHeadsError.message ?? "Unable to load payment account balances.")
  }

  if (historicalEntriesResult.error) {
    throw new Error(historicalEntriesResult.error.message ?? "Unable to calculate payment account balances.")
  }

  const balanceByHeadId = new Map<string, number>()

  for (const accountHead of (accountHeads ?? []) as Array<
    Pick<AccountHeadRow, "id" | "opening_balance" | "balance_type" | "type">
  >) {
    balanceByHeadId.set(
      accountHead.id,
      openingBalanceToSignedAmount({
        openingBalance: Number(accountHead.opening_balance ?? 0),
        balanceType: accountHead.balance_type ?? "debit",
        groupType: accountHead.type ?? "asset",
      })
    )
  }

  for (const entry of (historicalEntriesResult.data ?? []) as Array<
    Pick<VoucherEntryRow, "account_head_id" | "debit" | "credit">
  >) {
    const accountHeadId = entry.account_head_id

    if (!accountHeadId || !balanceByHeadId.has(accountHeadId)) {
      continue
    }

    const nextBalance =
      (balanceByHeadId.get(accountHeadId) ?? 0) + Number(entry.debit ?? 0) - Number(entry.credit ?? 0)

    balanceByHeadId.set(accountHeadId, Number(nextBalance.toFixed(2)))
  }

  return paymentModeRows.map((mode) => ({
    paymentModeId: mode.id,
    paymentModeName: mode.name,
    paymentModeType: mode.type,
    accountHeadId: mode.account_head_id,
    currentBalance: mode.account_head_id ? balanceByHeadId.get(mode.account_head_id) ?? 0 : null,
    isMapped: Boolean(mode.account_head_id),
  }))
}
