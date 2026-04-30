"use client"

import { calculateBalanceSheet, type ComparativeBalanceSheet } from "@/lib/accounting/balance-sheet"
import { keepPreviousData, useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
}

async function fetchBalanceSheet(filters: Filters): Promise<ComparativeBalanceSheet> {
  const supabase = createClient()
  return calculateBalanceSheet(supabase, filters.clientId, filters.fiscalYearId)
}

export function useBalanceSheet(filters: Filters | null) {
  const query = useAppQuery({
    queryKey: filters
      ? ["balance-sheet", filters.clientId, filters.fiscalYearId]
      : ["balance-sheet", "empty"],
    enabled: Boolean(filters),
    placeholderData: keepPreviousData,
    queryFn: () => fetchBalanceSheet(filters as Filters),
  })

  return {
    ...query,
    data: query.data ?? null,
  }
}
