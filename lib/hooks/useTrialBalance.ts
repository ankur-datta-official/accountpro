"use client"

import { calculateTrialBalance, type TrialBalanceResult } from "@/lib/accounting/trial-balance"
import { keepPreviousData, useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"

type TrialBalanceFilters = {
  clientId: string
  fiscalYearId: string
  fromDate?: string
  asOfDate?: string
}

async function fetchTrialBalance(filters: TrialBalanceFilters): Promise<TrialBalanceResult> {
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
  const query = useAppQuery({
    queryKey: filters
      ? [
          "trial-balance",
          filters.clientId,
          filters.fiscalYearId,
          filters.fromDate ?? "",
          filters.asOfDate ?? "",
        ]
      : ["trial-balance", "empty"],
    enabled: Boolean(filters),
    placeholderData: keepPreviousData,
    queryFn: () => fetchTrialBalance(filters as TrialBalanceFilters),
  })

  return {
    ...query,
    data: query.data ?? {
      accounts: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: true,
      difference: 0,
    },
  }
}
