"use client"

import { calculateProfitLoss, type ProfitLossResult } from "@/lib/accounting/profit-loss"
import { keepPreviousData, useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
}

async function fetchProfitLoss(filters: Filters): Promise<ProfitLossResult> {
  const supabase = createClient()
  return calculateProfitLoss(supabase, filters.clientId, filters.fiscalYearId)
}

export function useProfitLoss(filters: Filters | null) {
  return useAppQuery({
    queryKey: filters ? ["profit-loss", filters.clientId, filters.fiscalYearId] : ["profit-loss", "empty"],
    enabled: Boolean(filters),
    placeholderData: keepPreviousData,
    queryFn: () => fetchProfitLoss(filters as Filters),
  })
}
