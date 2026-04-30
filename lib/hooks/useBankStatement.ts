"use client"

import { calculateBankStatement, type BankStatementResult } from "@/lib/accounting/bank-statement"
import { keepPreviousData, useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"

type Filters = {
  clientId: string
  fiscalYearId: string
  paymentModeId: string
  fromDate: string
  toDate: string
}

async function fetchBankStatement(filters: Filters): Promise<BankStatementResult> {
  const supabase = createClient()
  return calculateBankStatement(supabase, filters)
}

export function useBankStatement(filters: Filters | null) {
  return useAppQuery({
    queryKey: filters
      ? [
          "bank-statement",
          filters.clientId,
          filters.fiscalYearId,
          filters.paymentModeId,
          filters.fromDate,
          filters.toDate,
        ]
      : ["bank-statement", "empty"],
    enabled: Boolean(filters),
    placeholderData: keepPreviousData,
    queryFn: () => fetchBankStatement(filters as Filters),
  })
}
