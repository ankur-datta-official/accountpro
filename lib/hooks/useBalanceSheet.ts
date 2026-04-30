"use client"

import useSWR from "swr"

import { calculateBalanceSheet, type ComparativeBalanceSheet } from "@/lib/accounting/balance-sheet"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
}

type FetchKey = [string, Filters]

async function fetchBalanceSheet([, filters]: FetchKey): Promise<ComparativeBalanceSheet> {
  const supabase = createClient()
  return calculateBalanceSheet(supabase, filters.clientId, filters.fiscalYearId)
}

export function useBalanceSheet(filters: Filters | null) {
  const key = filters
    ? ([`balance-sheet:${filters.clientId}:${filters.fiscalYearId}`, filters] as FetchKey)
    : null

  const swr = useSWR(key, fetchBalanceSheet, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  return {
    ...swr,
    data: swr.data ?? null,
  }
}
