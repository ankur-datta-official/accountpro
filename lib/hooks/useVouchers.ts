"use client"

import { fetchWithAccessToken, keepPreviousData, useAppQuery } from "@/lib/query"
import type { VoucherType } from "@/lib/types"

export type VoucherSortBy = "date" | "voucherNo" | "amount"
export type VoucherSortOrder = "asc" | "desc"

export type VoucherFilters = {
  fiscalYearId?: string
  from: string
  to: string
  voucherType: "all" | "payment" | "received" | "journal" | "contra" | "bf"
  paymentModeId?: string
  accountHeadId?: string
  month?: string
  search?: string
  page: number
  sortBy: VoucherSortBy
  sortOrder: VoucherSortOrder
}

export type VoucherListItem = {
  id: string
  voucherNo: number
  voucherDate: string
  voucherType: VoucherType
  paymentModeName: string | null
  accountHeadNames: string[]
  accountHeadLabel: string
  debit: number
  credit: number
  amount: number
  description: string | null
  monthLabel: string | null
  fiscalYearId: string | null
  updatedAt: string | null
}

type VoucherResponse = {
  items: VoucherListItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  stats: {
    totalReceipts: number
    totalPayments: number
    netBalance: number
  }
}

async function fetchVouchers(url: string) {
  return fetchWithAccessToken<VoucherResponse>(url)
}

export function useVouchers(clientId: string, filters: VoucherFilters) {
  const params = new URLSearchParams()

  if (filters.fiscalYearId) {
    params.set("fiscalYearId", filters.fiscalYearId)
  }

  params.set("from", filters.from)
  params.set("to", filters.to)
  params.set("voucherType", filters.voucherType)
  params.set("page", String(filters.page))
  params.set("pageSize", "50")
  params.set("sortBy", filters.sortBy)
  params.set("sortOrder", filters.sortOrder)

  if (filters.paymentModeId) {
    params.set("paymentModeId", filters.paymentModeId)
  }

  if (filters.accountHeadId) {
    params.set("accountHeadId", filters.accountHeadId)
  }

  if (filters.month) {
    params.set("month", filters.month)
  }

  if (filters.search) {
    params.set("search", filters.search)
  }

  const url = clientId ? `/api/clients/${clientId}/vouchers?${params.toString()}` : ""
  const query = useAppQuery({
    queryKey: clientId ? ["vouchers", clientId, params.toString()] : ["vouchers", "empty"],
    enabled: Boolean(clientId),
    placeholderData: keepPreviousData,
    queryFn: () => fetchVouchers(url),
  })

  return {
    ...query,
    mutate: async () => {
      await query.refetch()
    },
    items: query.data?.items ?? [],
    stats: query.data?.stats ?? {
      totalReceipts: 0,
      totalPayments: 0,
      netBalance: 0,
    },
    page: query.data?.page ?? filters.page,
    pageSize: query.data?.pageSize ?? 50,
    totalItems: query.data?.totalItems ?? 0,
    totalPages: query.data?.totalPages ?? 1,
  }
}
