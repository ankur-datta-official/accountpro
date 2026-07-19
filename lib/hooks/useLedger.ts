"use client"

import { useMemo } from "react"

import {
  calculateLedgerBalance,
  openingBalanceToSignedAmount,
  type LedgerEntryInput,
} from "@/lib/accounting/ledger"
import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import { keepPreviousData, useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"
import type {
  AccountGroupType,
  AccountHeadBalanceType,
  Database,
  VoucherType,
} from "@/lib/types"

export type LedgerFilters = {
  clientId: string
  accountHeadId: string
  fiscalYearId: string
  from?: string
  to?: string
}

export type LedgerEntryRow = LedgerEntryInput

export type LedgerResult = {
  accountHead: {
    id: string
    name: string
    openingBalance: number
    balanceType: AccountHeadBalanceType
    groupName: string
    groupType: AccountGroupType
    semiSubGroupName: string
    subGroupName: string
    path: string[]
  } | null
  openingBalanceAmount: number
  entries: ReturnType<typeof calculateLedgerBalance>["entries"]
  totals: {
    debit: number
    credit: number
    closingBalance: number
  }
}

async function fetchLedger(filters: LedgerFilters): Promise<LedgerResult> {
  const supabase = createClient()

  const [
    { data: accountHead },
    { data: allAccountHeads },
    { data: groups },
    { data: semiSubGroups },
    { data: subGroups },
  ] =
    await Promise.all([
      supabase.from("account_heads").select("*").eq("id", filters.accountHeadId).maybeSingle(),
      supabase.from("account_heads").select("*").eq("client_id", filters.clientId),
      supabase.from("account_groups").select("*").eq("client_id", filters.clientId),
      supabase.from("account_semi_sub_groups").select("*").eq("client_id", filters.clientId),
      supabase.from("account_sub_groups").select("*").eq("client_id", filters.clientId),
    ])

  if (!accountHead) {
    return {
      accountHead: null,
      openingBalanceAmount: 0,
      entries: [],
      totals: {
        debit: 0,
        credit: 0,
        closingBalance: 0,
      },
    }
  }

  const heads = allAccountHeads ?? []
  const hierarchy = resolveAccountHierarchy(accountHead, {
    accountHeads: heads,
    groups: groups ?? [],
    semiSubGroups: semiSubGroups ?? [],
    subGroups: subGroups ?? [],
  })
  const groupType = hierarchy.groupType
  const groupName = hierarchy.groupName
  const path = hierarchy.path
  const balanceType = (accountHead.balance_type ?? "debit") as AccountHeadBalanceType
  const openingBalance = Number(accountHead.opening_balance ?? 0)

  let voucherQuery = supabase
    .from("vouchers")
    .select("*")
    .eq("client_id", filters.clientId)
    .eq("fiscal_year_id", filters.fiscalYearId)
    .or("is_posted.eq.true,is_posted.is.null")
    .order("voucher_date", { ascending: true })
    .order("voucher_no", { ascending: true })

  if (filters.from) {
    voucherQuery = voucherQuery.gte("voucher_date", filters.from)
  }

  if (filters.to) {
    voucherQuery = voucherQuery.lte("voucher_date", filters.to)
  }

  const { data: vouchers } = await voucherQuery as { data: Database["public"]["Tables"]["vouchers"]["Row"][] | null }
  const voucherIds = (vouchers ?? []).map((voucher: Database["public"]["Tables"]["vouchers"]["Row"]) => voucher.id)
  const paymentModeIds = Array.from(
    new Set((vouchers ?? []).map((voucher: Database["public"]["Tables"]["vouchers"]["Row"]) => voucher.payment_mode_id).filter(Boolean) as string[])
  )

  const [voucherEntriesResult, paymentModesResult] = await Promise.all([
    voucherIds.length
      ? supabase
          .from("voucher_entries")
          .select("*")
          .eq("account_head_id", filters.accountHeadId)
          .in("voucher_id", voucherIds)
      : Promise.resolve({
          data: [] as Database["public"]["Tables"]["voucher_entries"]["Row"][],
        }),
    paymentModeIds.length
      ? supabase.from("payment_modes").select("*").in("id", paymentModeIds)
      : Promise.resolve({
          data: [] as Database["public"]["Tables"]["payment_modes"]["Row"][],
        }),
  ])

  const voucherEntries = voucherEntriesResult.data as Database["public"]["Tables"]["voucher_entries"]["Row"][] | null
  const paymentModes = paymentModesResult.data as Database["public"]["Tables"]["payment_modes"]["Row"][] | null

  const voucherMap = new Map((vouchers ?? []).map((voucher: Database["public"]["Tables"]["vouchers"]["Row"]) => [voucher.id, voucher]))
  const paymentModeMap = new Map((paymentModes ?? []).map((mode: Database["public"]["Tables"]["payment_modes"]["Row"]) => [mode.id, mode.name]))

  const rows = (voucherEntries ?? []) as Database["public"]["Tables"]["voucher_entries"]["Row"][]
  const mappedRows = rows.map<LedgerEntryRow | null>((entry) => {
    const voucher = voucherMap.get(entry.voucher_id ?? "")

    if (!voucher) {
      return null
    }

    return {
      id: entry.id,
      date: voucher.voucher_date,
      voucherNo: voucher.voucher_no,
      voucherType: voucher.voucher_type as VoucherType,
      paymentMode: paymentModeMap.get(voucher.payment_mode_id ?? "") ?? null,
      description: entry.description || voucher.description,
      debit: Number(entry.debit ?? 0),
      credit: Number(entry.credit ?? 0),
    }
  })
  const filteredRows = mappedRows.filter((row): row is LedgerEntryRow => Boolean(row))
  const sortedRows = filteredRows.sort((left: LedgerEntryRow, right: LedgerEntryRow) => {
    if (left.date === right.date) {
      return left.voucherNo - right.voucherNo
    }

    return left.date.localeCompare(right.date)
  })

  const bfRows = sortedRows.filter((row: LedgerEntryRow) => row.voucherType === "bf")
  const transactionRows = sortedRows.filter((row: LedgerEntryRow) => row.voucherType !== "bf")

  const bfOpeningSigned = bfRows.reduce((sum: number, row: LedgerEntryRow) => {
    const debitFirst = groupType === "asset" || groupType === "expense"
    return sum + (debitFirst ? row.debit - row.credit : row.credit - row.debit)
  }, 0)

  const fallbackOpeningSigned = openingBalanceToSignedAmount({
    openingBalance,
    balanceType,
    groupType,
  })

  const effectiveOpeningSigned = bfRows.length ? bfOpeningSigned : fallbackOpeningSigned
  const effectiveOpeningBalance = Math.abs(effectiveOpeningSigned)
  const effectiveOpeningType =
    effectiveOpeningSigned >= 0 ? balanceType : balanceType === "debit" ? "credit" : "debit"

  const { entries, closingBalance } = calculateLedgerBalance(
    transactionRows,
    effectiveOpeningBalance,
    effectiveOpeningType,
    groupType
  )

  return {
    accountHead: {
      id: accountHead.id,
      name: accountHead.name,
      openingBalance: openingBalance,
      balanceType,
      groupName,
      groupType,
      semiSubGroupName: hierarchy.semiSubGroupName,
      subGroupName: hierarchy.subGroupName,
      path,
    },
    openingBalanceAmount: effectiveOpeningSigned,
    entries,
    totals: {
      debit: transactionRows.reduce((sum: number, row: LedgerEntryRow) => sum + row.debit, 0),
      credit: transactionRows.reduce((sum: number, row: LedgerEntryRow) => sum + row.credit, 0),
      closingBalance,
    },
  }
}

export function useLedger(filters: LedgerFilters | null) {
  const query = useAppQuery<LedgerResult>({
    queryKey:
      filters?.clientId && filters?.accountHeadId && filters?.fiscalYearId
        ? [
            "ledger",
            filters.clientId,
            filters.accountHeadId,
            filters.fiscalYearId,
            filters.from ?? "",
            filters.to ?? "",
          ]
        : ["ledger", "empty"],
    enabled: Boolean(filters?.clientId && filters?.accountHeadId && filters?.fiscalYearId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchLedger(filters as LedgerFilters),
  })

  return useMemo(
    () => ({
      ...query,
      ledger: query.data ?? null,
    }),
    [query]
  )
}
