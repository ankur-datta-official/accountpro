"use client"

import useSWR from "swr"

import { createClient } from "@/lib/supabase/client"
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

async function fetchVouchers([url]: [string]) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Unauthorized")
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Unable to fetch vouchers." }))
    throw new Error(result.error ?? "Unable to fetch vouchers.")
  }

  return (await response.json()) as VoucherResponse
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

  const key = clientId ? ([`/api/clients/${clientId}/vouchers?${params.toString()}`] as [string]) : null
  const swr = useSWR(key, fetchVouchers, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  return {
    ...swr,
    items: swr.data?.items ?? [],
    stats: swr.data?.stats ?? {
      totalReceipts: 0,
      totalPayments: 0,
      netBalance: 0,
    },
    page: swr.data?.page ?? filters.page,
    pageSize: swr.data?.pageSize ?? 50,
    totalItems: swr.data?.totalItems ?? 0,
    totalPages: swr.data?.totalPages ?? 1,
  }
}
