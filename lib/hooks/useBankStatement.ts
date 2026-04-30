"use client"

import useSWR from "swr"

import { calculateBankStatement, type BankStatementResult } from "@/lib/accounting/bank-statement"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
  paymentModeId: string
  fromDate: string
  toDate: string
}

type FetchKey = [string, Filters]

async function fetchBankStatement([, filters]: FetchKey): Promise<BankStatementResult> {
  const supabase = createClient()
  return calculateBankStatement(supabase, filters)
}

export function useBankStatement(filters: Filters | null) {
  const key = filters
    ? ([`bank-statement:${filters.clientId}:${filters.fiscalYearId}:${filters.paymentModeId}:${filters.fromDate}:${filters.toDate}`, filters] as FetchKey)
    : null

  return useSWR(key, fetchBankStatement, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
}
