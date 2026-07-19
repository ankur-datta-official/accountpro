import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import type { AccountGroupType, AccountHeadBalanceType, Database } from "@/lib/types"

export type TrialBalanceRow = {
  accountHeadId: string
  accountHeadName: string
  groupType: AccountGroupType
  groupName: string
  subGroupName?: string
  semiSubGroupName?: string
  path: string[]
  openingBalance: number
  balanceType: AccountHeadBalanceType
  totalDebit: number
  totalCredit: number
  debit: number
  credit: number
  balanceLabel: string
}

export type TrialBalanceResult = {
  accounts: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  difference: number
}

function amountLabel({
  value,
  balanceType,
}: {
  value: number
  balanceType: AccountHeadBalanceType
}) {
  if (value === 0) {
    return "0.00 Dr"
  }

  if (balanceType === "debit") {
    return `${Math.abs(value).toFixed(2)} ${value >= 0 ? "Dr" : "Cr"}`
  }

  return `${Math.abs(value).toFixed(2)} ${value >= 0 ? "Cr" : "Dr"}`
}

function toTrialBalanceRows(input: {
  accountHeads: Database["public"]["Tables"]["account_heads"]["Row"][]
  groups: Database["public"]["Tables"]["account_groups"]["Row"][]
  semiSubGroups: Database["public"]["Tables"]["account_semi_sub_groups"]["Row"][]
  subGroups: Database["public"]["Tables"]["account_sub_groups"]["Row"][]
  voucherEntries: Database["public"]["Tables"]["voucher_entries"]["Row"][]
}) {
  const { accountHeads, groups, semiSubGroups, subGroups, voucherEntries } = input

  const debitCreditByHead = new Map<string, { debit: number; credit: number }>()

  for (const entry of voucherEntries) {
    const accountHeadId = entry.account_head_id

    if (!accountHeadId) {
      continue
    }

    const current = debitCreditByHead.get(accountHeadId) ?? { debit: 0, credit: 0 }
    current.debit += Number(entry.debit ?? 0)
    current.credit += Number(entry.credit ?? 0)
    debitCreditByHead.set(accountHeadId, current)
  }

  const rows: TrialBalanceRow[] = accountHeads.map((accountHead) => {
    const aggregate = debitCreditByHead.get(accountHead.id) ?? { debit: 0, credit: 0 }
    const openingBalance = Number(accountHead.opening_balance ?? 0)
    const balanceType = (accountHead.balance_type ?? "debit") as AccountHeadBalanceType
    const totalDebit = aggregate.debit
    const totalCredit = aggregate.credit

    const netBalance =
      balanceType === "debit"
        ? openingBalance + totalDebit - totalCredit
        : openingBalance + totalCredit - totalDebit

    let debit = 0
    let credit = 0

    if (balanceType === "debit") {
      debit = netBalance >= 0 ? netBalance : 0
      credit = netBalance < 0 ? Math.abs(netBalance) : 0
    } else {
      credit = netBalance >= 0 ? netBalance : 0
      debit = netBalance < 0 ? Math.abs(netBalance) : 0
    }

    const hierarchy = resolveAccountHierarchy(accountHead, {
      accountHeads,
      groups,
      semiSubGroups,
      subGroups,
    })

    return {
      accountHeadId: accountHead.id,
      accountHeadName: accountHead.name,
      groupType: hierarchy.groupType,
      groupName: hierarchy.groupName,
      subGroupName: hierarchy.subGroupName || undefined,
      semiSubGroupName: hierarchy.semiSubGroupName || undefined,
      path: hierarchy.path,
      openingBalance,
      balanceType,
      totalDebit,
      totalCredit,
      debit,
      credit,
      balanceLabel: amountLabel({ value: netBalance, balanceType }),
    }
  })

  return rows.sort((left, right) => {
    return left.accountHeadName.localeCompare(right.accountHeadName)
  })
}

export async function calculateTrialBalance(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId: string,
  asOfDate?: string,
  fromDate?: string
): Promise<TrialBalanceResult> {
  let voucherQuery = supabase
    .from("vouchers")
    .select("id")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .or("is_posted.eq.true,is_posted.is.null")

  if (fromDate) {
    voucherQuery = voucherQuery.gte("voucher_date", fromDate)
  }

  if (asOfDate) {
    voucherQuery = voucherQuery.lte("voucher_date", asOfDate)
  }

  const [
    { data: accountHeads },
    { data: vouchers },
    { data: groups },
    { data: semiSubGroups },
    { data: subGroups },
  ] =
    await Promise.all([
      supabase.from("account_heads").select("*").eq("client_id", clientId).or("is_active.eq.true,is_active.is.null"),
      voucherQuery,
      supabase.from("account_groups").select("*").eq("client_id", clientId),
      supabase.from("account_semi_sub_groups").select("*").eq("client_id", clientId),
      supabase.from("account_sub_groups").select("*").eq("client_id", clientId),
    ])

  const voucherIds = (vouchers ?? []).map((voucher) => voucher.id)
  const { data: voucherEntries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] as Database["public"]["Tables"]["voucher_entries"]["Row"][] }

  const rows = toTrialBalanceRows({
    accountHeads: accountHeads ?? [],
    groups: groups ?? [],
    semiSubGroups: semiSubGroups ?? [],
    subGroups: subGroups ?? [],
    voucherEntries: voucherEntries ?? [],
  })

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0)
  const difference = Number(Math.abs(totalDebit - totalCredit).toFixed(2))

  return {
    accounts: rows,
    totalDebit,
    totalCredit,
    isBalanced: difference === 0,
    difference,
  }
}
