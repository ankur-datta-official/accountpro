import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"

import { ClientFiscalYearSelect } from "@/components/clients/client-fiscal-year-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { getClientTypeLabel } from "@/lib/accounting/clients"
import { buildClientPath } from "@/lib/routing/clients"
import { createClient } from "@/lib/supabase/server"

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value)
}

type DashboardTotalEntry = {
  accounts_group: string | null
  debit: number | null
  credit: number | null
}

function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          </CardHeader>
          <CardContent>
            <div className="h-9 w-28 animate-pulse rounded bg-slate-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RecentVouchersSkeleton() {
  return (
    <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-xl text-slate-950">Recent vouchers</CardTitle>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-50" />
        ))}
      </CardContent>
    </Card>
  )
}

async function DashboardStats({
  clientId,
  fiscalYearId,
}: {
  clientId: string
  fiscalYearId: string | null
}) {
  if (!fiscalYearId) {
    return (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Vouchers", value: 0 },
          { label: "Total Income", value: currency(0) },
          { label: "Total Expense", value: currency(0) },
          { label: "Balance", value: currency(0) },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const supabase = await createClient()
  const [voucherCountResult, totalEntriesResult] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("fiscal_year_id", fiscalYearId),
    supabase
      .from("voucher_entries")
      .select("accounts_group,debit,credit,vouchers!inner(client_id,fiscal_year_id)")
      .eq("vouchers.client_id", clientId)
      .eq("vouchers.fiscal_year_id", fiscalYearId),
  ])

  let totalIncome = 0
  let totalExpense = 0

  const totalEntries = (totalEntriesResult.data ?? []) as DashboardTotalEntry[]
  for (const entry of totalEntries) {
    const accountGroup = entry.accounts_group?.toLowerCase()
    const debit = Number(entry.debit ?? 0)
    const credit = Number(entry.credit ?? 0)

    if (accountGroup === "income") {
      totalIncome += credit - debit
    }

    if (accountGroup === "expense") {
      totalExpense += debit - credit
    }
  }

  const balance = totalIncome - totalExpense

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Total Vouchers", value: voucherCountResult.count ?? 0 },
        { label: "Total Income", value: currency(totalIncome) },
        { label: "Total Expense", value: currency(totalExpense) },
        { label: "Balance", value: currency(balance) },
      ].map((stat) => (
        <Card key={stat.label} className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function RecentVouchersSection({
  clientId,
  clientPath,
  fiscalYearId,
}: {
  clientId: string
  clientPath: string
  fiscalYearId: string | null
}) {
  const emptyState = (
    <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-xl text-slate-950">Recent vouchers</CardTitle>
        <Button asChild variant="outline" className="rounded-xl border-slate-200">
          <Link href={`${clientPath}/vouchers/new`}>Add Voucher</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="py-10 text-center text-slate-500">No fiscal year selected yet.</div>
      </CardContent>
    </Card>
  )

  if (!fiscalYearId) {
    return emptyState
  }

  const supabase = await createClient()
  const { data: recentVouchers } = await supabase
    .from("vouchers")
    .select("id,voucher_no,voucher_date,voucher_type,description")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .order("voucher_date", { ascending: false })
    .order("voucher_no", { ascending: false })
    .limit(10)

  const voucherIds = (recentVouchers ?? []).map((voucher) => voucher.id)
  const { data: recentEntries } = voucherIds.length
    ? await supabase
        .from("voucher_entries")
        .select("voucher_id,debit,credit")
        .in("voucher_id", voucherIds)
    : { data: [] }

  const voucherEntryMap = new Map<string, number>()
  for (const entry of recentEntries ?? []) {
    const amount = Number(entry.debit ?? 0) + Number(entry.credit ?? 0)
    voucherEntryMap.set(entry.voucher_id ?? "", (voucherEntryMap.get(entry.voucher_id ?? "") ?? 0) + amount)
  }

  return (
    <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-xl text-slate-950">Recent vouchers</CardTitle>
        <Button asChild variant="outline" className="rounded-xl border-slate-200">
          <Link href={`${clientPath}/vouchers/new?fiscalYear=${fiscalYearId}`}>Add Voucher</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(recentVouchers ?? []).length ? (
              (recentVouchers ?? []).map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell className="font-medium text-slate-900">
                    <Link href={`${clientPath}/vouchers/${voucher.id}`} className="hover:underline">
                      {voucher.voucher_no}
                    </Link>
                  </TableCell>
                  <TableCell>{voucher.voucher_date}</TableCell>
                  <TableCell className="capitalize">{voucher.voucher_type}</TableCell>
                  <TableCell>{voucher.description || "-"}</TableCell>
                  <TableCell>{currency(voucherEntryMap.get(voucher.id) ?? 0)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                  No vouchers found for the selected fiscal year.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default async function ClientDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const { client, routeSegment, selectedFiscalYear } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams.fiscalYear,
  })

  if (!client) {
    notFound()
  }

  const clientPath = buildClientPath({
    id: client.id,
    name: client.name,
    routeSegment,
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Client profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Client name</p>
              <p className="mt-1 font-medium text-slate-950">{client.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Type</p>
              <p className="mt-1 font-medium text-slate-950">{getClientTypeLabel(client.type)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">TIN</p>
              <p className="mt-1 font-medium text-slate-950">{client.tin || "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">BIN</p>
              <p className="mt-1 font-medium text-slate-950">{client.bin || "Not provided"}</p>
            </div>
            <div className="sm:col-span-2">
              <Badge
                className={
                  client.is_active
                    ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                    : "rounded-full bg-slate-100 text-slate-500"
                }
              >
                {client.is_active ? "Active client" : "Inactive client"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Active fiscal year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClientFiscalYearSelect />
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {selectedFiscalYear ? (
                <>
                  <p className="font-medium text-slate-900">{selectedFiscalYear.label}</p>
                  <p className="mt-1">
                    {selectedFiscalYear.start_date} to {selectedFiscalYear.end_date}
                  </p>
                </>
              ) : (
                <p>No fiscal year available yet.</p>
              )}
            </div>
            <Button asChild variant="outline" className="rounded-xl border-slate-200">
              <Link href={`${clientPath}/settings/fiscal-years`}>Manage Fiscal Years</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link href={`${clientPath}/vouchers/new?fiscalYear=${selectedFiscalYear?.id ?? ""}`}>
                New Voucher
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats clientId={client.id} fiscalYearId={selectedFiscalYear?.id ?? null} />
      </Suspense>

      <Suspense fallback={<RecentVouchersSkeleton />}>
        <RecentVouchersSection
          clientId={client.id}
          clientPath={clientPath}
          fiscalYearId={selectedFiscalYear?.id ?? null}
        />
      </Suspense>
    </div>
  )
}
