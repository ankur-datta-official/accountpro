"use client"

import { useMemo } from "react"

import type { LedgerDatasetResult } from "@/lib/accounting/ledger-dataset"
import { fetchWithAccessToken, keepPreviousData, useAppQuery } from "@/lib/query"

export type LedgerDatasetFilters = {
  clientId: string
  fiscalYearId: string
  from: string
  to: string
}

export function useLedgerDataset(filters: LedgerDatasetFilters | null) {
  const params = useMemo(() => {
    if (!filters) {
      return ""
    }

    return new URLSearchParams({
      fiscalYearId: filters.fiscalYearId,
      from: filters.from,
      to: filters.to,
    }).toString()
  }, [filters])

  const query = useAppQuery<LedgerDatasetResult>({
    queryKey: filters ? ["ledger-dataset", filters.clientId, params] : ["ledger-dataset", "empty"],
    enabled: Boolean(filters?.clientId && filters?.fiscalYearId && filters?.from && filters?.to),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    queryFn: () => fetchWithAccessToken<LedgerDatasetResult>(`/api/clients/${filters?.clientId}/ledger?${params}`),
  })

  return useMemo(
    () => ({
      ...query,
      dataset: query.data ?? null,
    }),
    [query]
  )
}
