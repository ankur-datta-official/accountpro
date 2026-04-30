import Link from "next/link"
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
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value)
}

export default async function ClientDashboardPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  if (!client) {
    notFound()
  }

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const selectedFiscalYear =
    fiscalYears?.find((year) => year.id === searchParams.fiscalYear) ??
    fiscalYears?.find((year) => year.is_active) ??
    fiscalYears?.[0] ??
    null

  const { data: vouchers } = selectedFiscalYear
    ? await supabase
        .from("vouchers")
        .select("*")
        .eq("client_id", client.id)
        .eq("fiscal_year_id", selectedFiscalYear.id)
        .order("voucher_date", { ascending: false })
    : { data: [] }

  const recentVouchers = (vouchers ?? []).slice(0, 10)
  const voucherIds = recentVouchers.map((voucher) => voucher.id)
  const allVoucherIds = (vouchers ?? []).map((voucher) => voucher.id)

  const { data: recentEntries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] }

  const { data: allEntries } = allVoucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", allVoucherIds)
    : { data: [] }

  const voucherEntryMap = new Map<string, number>()
  for (const entry of recentEntries ?? []) {
    const amount = Number(entry.debit ?? 0) + Number(entry.credit ?? 0)
    voucherEntryMap.set(entry.voucher_id ?? "", (voucherEntryMap.get(entry.voucher_id ?? "") ?? 0) + amount)
  }

  let totalIncome = 0
  let totalExpense = 0

  for (const entry of allEntries ?? []) {
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
              <p className="mt-1 font-medium capitalize text-slate-950">{client.type ?? "company"}</p>
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
              <Link href={`/clients/${client.id}/settings/fiscal-years`}>Manage Fiscal Years</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link href={`/clients/${client.id}/vouchers/new?fiscalYear=${selectedFiscalYear?.id ?? ""}`}>
                New Voucher
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Vouchers", value: vouchers?.length ?? 0 },
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

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-xl text-slate-950">Recent vouchers</CardTitle>
          <Button asChild variant="outline" className="rounded-xl border-slate-200">
            <Link href={`/clients/${client.id}/vouchers/new?fiscalYear=${selectedFiscalYear?.id ?? ""}`}>
              Add Voucher
            </Link>
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
              {recentVouchers.length ? (
                recentVouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-medium text-slate-900">
                      <Link href={`/clients/${client.id}/vouchers/${voucher.id}`} className="hover:underline">
                        {voucher.voucher_no}
                      </Link>
                    </TableCell>
                    <TableCell>{voucher.voucher_date}</TableCell>
                    <TableCell className="capitalize">{voucher.voucher_type}</TableCell>
                    <TableCell>{voucher.description || "—"}</TableCell>
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
    </div>
  )
}
