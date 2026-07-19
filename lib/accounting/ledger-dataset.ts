import type { SupabaseClient } from "@supabase/supabase-js"

import {
  calculateLedgerBalance,
  openingBalanceToSignedAmount,
  signedBalanceToLabel,
  type LedgerEntryInput,
} from "@/lib/accounting/ledger"
import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import type {
  AccountGroupType,
  AccountHeadBalanceType,
  Database,
  VoucherType,
} from "@/lib/types"

export type LedgerDatasetFilters = {
  clientId: string
  fiscalYearId: string
  from?: string
  to?: string
}

export type LedgerDatasetSection = {
  accountHeadId: string
  accountName: string
  groupName: string
  groupType: AccountGroupType
  periodLabel: string
  openingBalanceLabel: string
  totalDebit: number
  totalCredit: number
  closingBalance: number
  rows: Array<{
    id: string
    date: string
    voucherNo: number
    voucherType: VoucherType
    paymentMode: string | null
    description: string | null
    debit: number
    credit: number
    runningBalance: number
  }>
}

export type LedgerDatasetAccountSummary = {
  accountHeadId: string
  accountName: string
  groupName: string
  groupType: AccountGroupType
  semiSubGroupName: string
  subGroupName: string
  path: string[]
  hierarchyLabel: string
  openingBalanceAmount: number
  openingBalanceLabel: string
  totalDebit: number
  totalCredit: number
  closingBalance: number
  closingBalanceLabel: string
  rowCount: number
  lastActivityDate: string | null
  hasActivity: boolean
}

export type LedgerDatasetResult = {
  accounts: LedgerDatasetAccountSummary[]
  sections: LedgerDatasetSection[]
  stats: {
    totalAccounts: number
    activeAccounts: number
    accountsWithMovements: number
    totalRows: number
    totalDebit: number
    totalCredit: number
  }
}

type LedgerAccountState = {
  accountHeadId: string
  accountName: string
  groupName: string
  groupType: AccountGroupType
  semiSubGroupName: string
  subGroupName: string
  path: string[]
  openingBalance: number
  balanceType: AccountHeadBalanceType
  rows: LedgerEntryInput[]
}

function buildPeriodLabel(from?: string, to?: string) {
  if (from && to) {
    return `${from} to ${to}`
  }

  if (from) {
    return `From ${from}`
  }

  if (to) {
    return `Up to ${to}`
  }

  return "Full period"
}

function isDebitFirstAccount(groupType: AccountGroupType) {
  return groupType === "asset" || groupType === "expense"
}

export async function buildLedgerDataset(
  supabase: SupabaseClient<Database>,
  filters: LedgerDatasetFilters
): Promise<LedgerDatasetResult> {
  let vouchersQuery = supabase
    .from("vouchers")
    .select("id, voucher_date, voucher_no, voucher_type, payment_mode_id, description")
    .eq("client_id", filters.clientId)
    .eq("fiscal_year_id", filters.fiscalYearId)
    .or("is_posted.eq.true,is_posted.is.null")

  if (filters.from) {
    vouchersQuery = vouchersQuery.gte("voucher_date", filters.from)
  }

  if (filters.to) {
    vouchersQuery = vouchersQuery.lte("voucher_date", filters.to)
  }

  const [
    { data: accountHeads, error: accountHeadsError },
    { data: groups, error: groupsError },
    { data: semiSubGroups, error: semiSubGroupsError },
    { data: subGroups, error: subGroupsError },
    { data: vouchers, error: vouchersError },
  ] = await Promise.all([
    supabase.from("account_heads").select("*").eq("client_id", filters.clientId).or("is_active.eq.true,is_active.is.null"),
    supabase.from("account_groups").select("*").eq("client_id", filters.clientId),
    supabase.from("account_semi_sub_groups").select("*").eq("client_id", filters.clientId),
    supabase.from("account_sub_groups").select("*").eq("client_id", filters.clientId),
    vouchersQuery,
  ])

  const error =
    accountHeadsError ??
    groupsError ??
    semiSubGroupsError ??
    subGroupsError ??
    vouchersError

  if (error) {
    throw new Error(error.message)
  }

  const activeHeads = (accountHeads ?? []) as Database["public"]["Tables"]["account_heads"]["Row"][]
  const parentIds = new Set(activeHeads.map((head) => head.parent_id).filter(Boolean))
  const postingHeads = activeHeads.filter((head) => !parentIds.has(head.id))

  const voucherRows = (vouchers ?? []) as Array<
    Pick<
      Database["public"]["Tables"]["vouchers"]["Row"],
      "id" | "voucher_date" | "voucher_no" | "voucher_type" | "payment_mode_id" | "description"
    >
  >
  const voucherIds = voucherRows.map((voucher) => voucher.id)
  const paymentModeIds = Array.from(
    new Set(voucherRows.map((voucher) => voucher.payment_mode_id).filter(Boolean) as string[])
  )

  const [{ data: voucherEntries }, { data: paymentModes }] = await Promise.all([
    voucherIds.length
      ? supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
      : Promise.resolve({
          data: [] as Database["public"]["Tables"]["voucher_entries"]["Row"][],
        }),
    paymentModeIds.length
      ? supabase.from("payment_modes").select("*").in("id", paymentModeIds)
      : Promise.resolve({
          data: [] as Database["public"]["Tables"]["payment_modes"]["Row"][],
        }),
  ])

  const periodLabel = buildPeriodLabel(filters.from, filters.to)
  const voucherMap = new Map(voucherRows.map((voucher) => [voucher.id, voucher]))
  const paymentModeMap = new Map(
    ((paymentModes ?? []) as Database["public"]["Tables"]["payment_modes"]["Row"][]).map((mode) => [mode.id, mode.name])
  )

  const accountStateMap = new Map<string, LedgerAccountState>()

  for (const accountHead of postingHeads) {
    const hierarchy = resolveAccountHierarchy(accountHead, {
      accountHeads: activeHeads,
      groups: (groups ?? []) as Database["public"]["Tables"]["account_groups"]["Row"][],
      semiSubGroups: (semiSubGroups ?? []) as Database["public"]["Tables"]["account_semi_sub_groups"]["Row"][],
      subGroups: (subGroups ?? []) as Database["public"]["Tables"]["account_sub_groups"]["Row"][],
    })

    accountStateMap.set(accountHead.id, {
      accountHeadId: accountHead.id,
      accountName: accountHead.name,
      groupName: hierarchy.groupName,
      groupType: hierarchy.groupType,
      semiSubGroupName: hierarchy.semiSubGroupName,
      subGroupName: hierarchy.subGroupName,
      path: hierarchy.path,
      openingBalance: Number(accountHead.opening_balance ?? 0),
      balanceType: (accountHead.balance_type ?? "debit") as AccountHeadBalanceType,
      rows: [],
    })
  }

  for (const entry of (voucherEntries ?? []) as Database["public"]["Tables"]["voucher_entries"]["Row"][]) {
    const accountHeadId = entry.account_head_id

    if (!accountHeadId) {
      continue
    }

    const accountState = accountStateMap.get(accountHeadId)
    const voucher = voucherMap.get(entry.voucher_id ?? "")

    if (!accountState || !voucher) {
      continue
    }

    accountState.rows.push({
      id: entry.id,
      date: voucher.voucher_date,
      voucherNo: voucher.voucher_no,
      voucherType: voucher.voucher_type as VoucherType,
      paymentMode: paymentModeMap.get(voucher.payment_mode_id ?? "") ?? null,
      description: entry.description || voucher.description,
      debit: Number(entry.debit ?? 0),
      credit: Number(entry.credit ?? 0),
    })
  }

  const accounts: LedgerDatasetAccountSummary[] = []
  const sections: LedgerDatasetSection[] = []

  for (const accountState of accountStateMap.values()) {
    const sortedRows = [...accountState.rows].sort((left, right) => {
      if (left.date === right.date) {
        return left.voucherNo - right.voucherNo
      }

      return left.date.localeCompare(right.date)
    })

    const openingRows = sortedRows.filter((row) => row.voucherType === "bf")
    const transactionRows = sortedRows.filter((row) => row.voucherType !== "bf")

    const debitFirst = isDebitFirstAccount(accountState.groupType)
    const bfOpeningSigned = openingRows.reduce((sum, row) => {
      return sum + (debitFirst ? row.debit - row.credit : row.credit - row.debit)
    }, 0)

    const fallbackOpeningSigned = openingBalanceToSignedAmount({
      openingBalance: accountState.openingBalance,
      balanceType: accountState.balanceType,
      groupType: accountState.groupType,
    })

    const openingBalanceAmount = openingRows.length > 0 ? bfOpeningSigned : fallbackOpeningSigned
    const effectiveOpeningBalance = Math.abs(openingBalanceAmount)
    const effectiveOpeningType =
      openingBalanceAmount >= 0
        ? accountState.balanceType
        : accountState.balanceType === "debit"
          ? "credit"
          : "debit"

    const { entries, closingBalance } = calculateLedgerBalance(
      transactionRows,
      effectiveOpeningBalance,
      effectiveOpeningType,
      accountState.groupType
    )

    const totalDebit = transactionRows.reduce((sum, row) => sum + row.debit, 0)
    const totalCredit = transactionRows.reduce((sum, row) => sum + row.credit, 0)
    const hasActivity = transactionRows.length > 0 || openingBalanceAmount !== 0
    const hierarchyLabel = accountState.path.join(" > ")
    const lastActivityDate = transactionRows[transactionRows.length - 1]?.date ?? null

    accounts.push({
      accountHeadId: accountState.accountHeadId,
      accountName: accountState.accountName,
      groupName: accountState.groupName,
      groupType: accountState.groupType,
      semiSubGroupName: accountState.semiSubGroupName,
      subGroupName: accountState.subGroupName,
      path: accountState.path,
      hierarchyLabel,
      openingBalanceAmount,
      openingBalanceLabel: signedBalanceToLabel(openingBalanceAmount, accountState.groupType),
      totalDebit,
      totalCredit,
      closingBalance,
      closingBalanceLabel: signedBalanceToLabel(closingBalance, accountState.groupType),
      rowCount: transactionRows.length,
      lastActivityDate,
      hasActivity,
    })

    sections.push({
      accountHeadId: accountState.accountHeadId,
      accountName: accountState.accountName,
      groupName: accountState.groupName,
      groupType: accountState.groupType,
      periodLabel,
      openingBalanceLabel: signedBalanceToLabel(openingBalanceAmount, accountState.groupType),
      totalDebit,
      totalCredit,
      closingBalance,
      rows: entries,
    })
  }

  accounts.sort((left, right) => left.hierarchyLabel.localeCompare(right.hierarchyLabel))
  sections.sort((left, right) => left.accountName.localeCompare(right.accountName))

  const activeAccounts = accounts.filter((account) => account.hasActivity)
  const accountsWithMovements = accounts.filter((account) => account.rowCount > 0)

  return {
    accounts,
    sections,
    stats: {
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      accountsWithMovements: accountsWithMovements.length,
      totalRows: accounts.reduce((sum, account) => sum + account.rowCount, 0),
      totalDebit: accounts.reduce((sum, account) => sum + account.totalDebit, 0),
      totalCredit: accounts.reduce((sum, account) => sum + account.totalCredit, 0),
    },
  }
}
