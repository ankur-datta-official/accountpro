"use client"

import useSWR from "swr"

import { calculateTrialBalance, type TrialBalanceResult } from "@/lib/accounting/trial-balance"
import { createClient } from "@/lib/supabase/client"

type TrialBalanceFilters = {
  clientId: string
  fiscalYearId: string
  fromDate?: string
  asOfDate?: string
}

type FetchKey = [string, TrialBalanceFilters]

async function fetchTrialBalance([, filters]: FetchKey): Promise<TrialBalanceResult> {
  const supabase = createClient()
  return calculateTrialBalance(
    supabase,
    filters.clientId,
    filters.fiscalYearId,
    filters.asOfDate,
    filters.fromDate
  )
}

export function useTrialBalance(filters: TrialBalanceFilters | null) {
  const key = filters
    ? ([`trial-balance:${filters.clientId}:${filters.fiscalYearId}:${filters.fromDate ?? ""}:${filters.asOfDate ?? ""}`, filters] as FetchKey)
    : null

  const swr = useSWR(key, fetchTrialBalance, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  return {
    ...swr,
    data: swr.data ?? {
      accounts: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: true,
      difference: 0,
    },
  }
}
