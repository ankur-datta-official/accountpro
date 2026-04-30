"use client"

import useSWR from "swr"

import { calculateProfitLoss, type ProfitLossResult } from "@/lib/accounting/profit-loss"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
}

type FetchKey = [string, Filters]

async function fetchProfitLoss([, filters]: FetchKey): Promise<ProfitLossResult> {
  const supabase = createClient()
  return calculateProfitLoss(supabase, filters.clientId, filters.fiscalYearId)
}

export function useProfitLoss(filters: Filters | null) {
  const key = filters ? ([`profit-loss:${filters.clientId}:${filters.fiscalYearId}`, filters] as FetchKey) : null

  return useSWR(key, fetchProfitLoss, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
}
