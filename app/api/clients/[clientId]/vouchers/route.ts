import { NextResponse } from "next/server"
import { z } from "zod"

import { isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getAuthorizedClient } from "@/lib/api-auth"
import type { VoucherType, Voucher, VoucherEntry, AccountHead, PaymentMode } from "@/lib/types"

const vouchersQuerySchema = z.object({
  fiscalYearId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  voucherType: z.enum(["all", "payment", "received", "journal", "contra", "bf"]).default("all"),
  paymentModeId: z.string().optional(),
  accountHeadId: z.string().optional(),
  month: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["date", "voucherNo", "amount"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

type VoucherListItem = {
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

type VoucherQueryResult = {
  data: Voucher[] | null
  error: { message: string } | null
}

type VoucherEntriesResult = {
  data: VoucherEntry[] | null
}

function createServiceRoleClient() {
  return supabaseAdmin
}

function buildAccountHeadLabel(names: string[]) {
  if (!names.length) {
    return "—"
  }

  if (names.length <= 2) {
    return names.join(", ")
  }

  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = vouchersQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid voucher filters." },
      { status: 400 }
    )
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const filters = parsed.data
  let vouchersQuery = supabase.from("vouchers").select("*").eq("client_id", client.id).or("is_posted.eq.true,is_posted.is.null")

  if (filters.fiscalYearId) {
    vouchersQuery = vouchersQuery.eq("fiscal_year_id", filters.fiscalYearId)
  }

  if (filters.from) {
    vouchersQuery = vouchersQuery.gte("voucher_date", filters.from)
  }

  if (filters.to) {
    vouchersQuery = vouchersQuery.lte("voucher_date", filters.to)
  }

  if (filters.voucherType !== "all") {
    vouchersQuery = vouchersQuery.eq("voucher_type", filters.voucherType)
  }

  if (filters.paymentModeId) {
    vouchersQuery = vouchersQuery.eq("payment_mode_id", filters.paymentModeId)
  }

  if (filters.month) {
    vouchersQuery = vouchersQuery.eq("month_label", filters.month)
  }

  if (filters.search) {
    vouchersQuery = vouchersQuery.ilike("description", `%${filters.search}%`)
  }

  const { data: vouchers, error } = (await vouchersQuery.order("voucher_date", {
    ascending: false,
  })) as VoucherQueryResult

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const voucherIds = (vouchers ?? [] as Voucher[]).map((voucher) => voucher.id)
  const entriesResult: VoucherEntriesResult = voucherIds.length
    ? await (supabase
        .from("voucher_entries")
        .select("*")
        .in("voucher_id", voucherIds) as Promise<VoucherEntriesResult>)
    : { data: [] }
  const entries = entriesResult.data;

  const matchingVoucherIds = filters.accountHeadId
    ? new Set(
        (entries ?? [] as VoucherEntry[])
          .filter((entry: VoucherEntry) => entry.account_head_id === filters.accountHeadId)
          .map((entry: VoucherEntry) => entry.voucher_id)
      )
    : null

  const filteredVouchers = matchingVoucherIds
    ? (vouchers ?? [] as Voucher[]).filter((voucher: Voucher) => matchingVoucherIds.has(voucher.id))
    : (vouchers ?? [] as Voucher[])

  const filteredIds = new Set(filteredVouchers.map((voucher: Voucher) => voucher.id))
  const filteredEntries = (entries ?? [] as VoucherEntry[]).filter((entry: VoucherEntry) => filteredIds.has(entry.voucher_id ?? ""))

  const accountHeadIds = Array.from(
    new Set(filteredEntries.map((entry: VoucherEntry) => entry.account_head_id).filter(Boolean) as string[])
  )
  const paymentModeIds = Array.from(
    new Set(filteredVouchers.map((voucher: Voucher) => voucher.payment_mode_id).filter(Boolean) as string[])
  )

  const accountHeadsPromise = accountHeadIds.length
    ? supabase.from("account_heads").select("*").in("id", accountHeadIds) as Promise<{ data: AccountHead[] | null }>
    : Promise.resolve({ data: [] });
  const paymentModesPromise = paymentModeIds.length
    ? supabase.from("payment_modes").select("*").in("id", paymentModeIds) as Promise<{ data: PaymentMode[] | null }>
    : Promise.resolve({ data: [] });
  const [accountHeadsResult, paymentModesResult] = await Promise.all([
    accountHeadsPromise,
    paymentModesPromise,
  ]);
  const accountHeads = accountHeadsResult.data;
  const paymentModes = paymentModesResult.data;

  const accountHeadMap = new Map((accountHeads ?? [] as AccountHead[]).map((head: AccountHead) => [head.id, head.name]))
  const paymentModeMap = new Map((paymentModes ?? [] as PaymentMode[]).map((mode: PaymentMode) => [mode.id, mode.name]))

  const entriesByVoucher = filteredEntries.reduce<Record<string, VoucherEntry[]>>((acc: Record<string, VoucherEntry[]>, entry: VoucherEntry) => {
    const voucherId = entry.voucher_id ?? ""

    if (!acc[voucherId]) {
      acc[voucherId] = []
    }

    acc[voucherId].push(entry)
    return acc
  }, {})

  const items: VoucherListItem[] = filteredVouchers.map((voucher: Voucher) => {
    const voucherEntries = entriesByVoucher[voucher.id] ?? []
    const visibleEntries = voucherEntries.filter((entry: VoucherEntry) => !isAutoBalanceEntry(entry.description))
    const accountHeadNames = (visibleEntries.length ? visibleEntries : voucherEntries)
      .map((entry: VoucherEntry) => accountHeadMap.get(entry.account_head_id ?? ""))
      .filter(Boolean) as string[]

    const debit = voucherEntries.reduce((sum: number, entry: VoucherEntry) => sum + Number(entry.debit ?? 0), 0)
    const credit = voucherEntries.reduce((sum: number, entry: VoucherEntry) => sum + Number(entry.credit ?? 0), 0)

    return {
      id: voucher.id,
      voucherNo: voucher.voucher_no,
      voucherDate: voucher.voucher_date,
      voucherType: voucher.voucher_type,
      paymentModeName: paymentModeMap.get(voucher.payment_mode_id ?? "") ?? null,
      accountHeadNames,
      accountHeadLabel: buildAccountHeadLabel(accountHeadNames),
      debit,
      credit,
      amount: Math.max(debit, credit),
      description: voucher.description,
      monthLabel: voucher.month_label,
      fiscalYearId: voucher.fiscal_year_id,
      updatedAt: voucher.updated_at,
    }
  })

  items.sort((left, right) => {
    const direction = filters.sortOrder === "asc" ? 1 : -1

    if (filters.sortBy === "voucherNo") {
      return (left.voucherNo - right.voucherNo) * direction
    }

    if (filters.sortBy === "amount") {
      return (left.amount - right.amount) * direction
    }

    const dateDiff =
      new Date(left.voucherDate).getTime() - new Date(right.voucherDate).getTime()

    if (dateDiff !== 0) {
      return dateDiff * direction
    }

    return (left.voucherNo - right.voucherNo) * direction
  })

  const totalReceipts = items
    .filter((item) => item.voucherType === "received")
    .reduce((sum, item) => sum + item.amount, 0)
  const totalPayments = items
    .filter((item) => item.voucherType === "payment")
    .reduce((sum, item) => sum + item.amount, 0)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize))
  const page = Math.min(filters.page, totalPages)
  const startIndex = (page - 1) * filters.pageSize

  return NextResponse.json({
    items: items.slice(startIndex, startIndex + filters.pageSize),
    page,
    pageSize: filters.pageSize,
    totalItems,
    totalPages,
    stats: {
      totalReceipts,
      totalPayments,
      netBalance: totalReceipts - totalPayments,
    },
  })
}
