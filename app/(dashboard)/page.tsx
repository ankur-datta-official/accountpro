import Link from "next/link"
import { startOfMonth } from "date-fns"
import { redirect } from "next/navigation"

import { AlertBanner, type AlertItem } from "@/components/layout/AlertBanner"
import { DashboardQuickActions } from "@/components/layout/DashboardQuickActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

function formatMonthStart(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { organization, membership, user } = await getCurrentOrganizationContext()

  if (!user) {
    redirect("/login")
  }

  const orgId = membership?.org_id ?? null

  const [{ count: totalClients }, { count: teamMembers }, { data: orgClients }] = await Promise.all([
    orgId
      ? supabase.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    orgId
      ? supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", orgId)
      : Promise.resolve({ count: 0 }),
    orgId ? supabase.from("clients").select("*").eq("org_id", orgId).order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
  ])

  const clientIds = orgClients?.map((client) => client.id) ?? []
  const monthStart = formatMonthStart(startOfMonth(new Date()))

  const [{ count: thisMonthVouchers }, { count: activeFiscalYears }, { data: recentVouchers }, { data: fiscalYears }] = await Promise.all([
    clientIds.length
      ? supabase
          .from("vouchers")
          .select("id", { count: "exact", head: true })
          .in("client_id", clientIds)
          .gte("voucher_date", monthStart)
      : Promise.resolve({ count: 0 }),
    clientIds.length
      ? supabase
          .from("fiscal_years")
          .select("id", { count: "exact", head: true })
          .in("client_id", clientIds)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    clientIds.length
      ? supabase
          .from("vouchers")
          .select("*")
          .in("client_id", clientIds)
          .order("voucher_date", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? supabase.from("fiscal_years").select("*").in("client_id", clientIds)
      : Promise.resolve({ data: [] }),
  ])

  const recentVoucherIds = (recentVouchers ?? []).map((voucher) => voucher.id)
  const { data: recentEntries } = recentVoucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", recentVoucherIds)
    : { data: [] }
  const { data: recentHeads } = recentEntries?.length
    ? await supabase
        .from("account_heads")
        .select("*")
        .in(
          "id",
          Array.from(
            new Set((recentEntries ?? []).map((entry) => entry.account_head_id).filter(Boolean))
          ) as string[]
        )
    : { data: [] }

  const headMap = new Map((recentHeads ?? []).map((head) => [head.id, head.name]))
  const clientNameMap = new Map((orgClients ?? []).map((client) => [client.id, client.name]))

  const voucherSummaryMap = new Map<string, { amount: number; headName: string }>()
  for (const entry of recentEntries ?? []) {
    const voucherId = entry.voucher_id ?? ""
    const amount = Math.max(Number(entry.debit ?? 0), Number(entry.credit ?? 0))
    const existing = voucherSummaryMap.get(voucherId) ?? { amount: 0, headName: "—" }
    voucherSummaryMap.set(voucherId, {
      amount: existing.amount + amount,
      headName: existing.headName === "—" ? headMap.get(entry.account_head_id ?? "") ?? "—" : existing.headName,
    })
  }

  const activeFiscalYearMap = new Map(
    (fiscalYears ?? []).filter((year) => year.is_active).map((year) => [year.client_id, year.label])
  )

  const thisMonthByClient = new Map<string, { receipts: number; payments: number }>()
  const thisMonthList = (recentVouchers ?? []).filter((voucher) => voucher.voucher_date >= monthStart)
  for (const voucher of thisMonthList) {
    const clientId = voucher.client_id ?? ""
    const prev = thisMonthByClient.get(clientId) ?? { receipts: 0, payments: 0 }
    if (voucher.voucher_type === "received") prev.receipts += 1
    if (voucher.voucher_type === "payment") prev.payments += 1
    thisMonthByClient.set(clientId, prev)
  }

  const alertItems: AlertItem[] = []
  const unbalancedClientIds = new Set<string>()
  const entriesForAll = clientIds.length
    ? await supabase
        .from("voucher_entries")
        .select("voucher_id,debit,credit")
        .in(
          "voucher_id",
          (recentVouchers ?? []).map((voucher) => voucher.id)
        )
    : { data: [] }
  const voucherClientMap = new Map((recentVouchers ?? []).map((voucher) => [voucher.id, voucher.client_id]))
  const clientTotals = new Map<string, { debit: number; credit: number }>()
  for (const entry of entriesForAll.data ?? []) {
    const clientId = voucherClientMap.get(entry.voucher_id ?? "") ?? ""
    if (!clientId) continue
    const prev = clientTotals.get(clientId) ?? { debit: 0, credit: 0 }
    prev.debit += Number(entry.debit ?? 0)
    prev.credit += Number(entry.credit ?? 0)
    clientTotals.set(clientId, prev)
  }
  for (const [clientId, totals] of Array.from(clientTotals.entries())) {
    if (Math.abs(totals.debit - totals.credit) > 0.001) {
      unbalancedClientIds.add(clientId)
    }
  }
  if (unbalancedClientIds.size) {
    alertItems.push({
      id: "unbalanced-trial-balance",
      message: `${unbalancedClientIds.size} clients have unbalanced Trial Balances`,
      href: "/clients",
    })
  }

  const now = new Date()
  const warningYear = (fiscalYears ?? []).find((year) => {
    if (!year.is_active || year.is_closed) return false
    const days = Math.ceil((new Date(year.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  })
  if (warningYear?.client_id) {
    const clientName = clientNameMap.get(warningYear.client_id) ?? "Client"
    alertItems.push({
      id: `fiscal-year-ending-${warningYear.id}`,
      message: `Fiscal year ${warningYear.label} for ${clientName} ends in 30 days`,
      href: `/clients/${warningYear.client_id}/settings`,
    })
  }

  if (organization?.plan === "starter" && (totalClients ?? 0) >= 5) {
    alertItems.push({
      id: "starter-limit-reached",
      message: "You've reached 5/5 clients on Starter plan",
      href: "/settings",
    })
  }

  const userName = user.user_metadata.full_name || user.email || "AccountPro User"

  const stats = [
    { label: "Total Clients", value: totalClients ?? 0, detail: "Active client workspaces" },
    { label: "This Month Vouchers", value: thisMonthVouchers ?? 0, detail: "Voucher records this month" },
    { label: "Team Members", value: teamMembers ?? 0, detail: "Users with organization access" },
    { label: "Active Fiscal Years", value: activeFiscalYears ?? 0, detail: "Open periods across clients" },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Welcome to AccountPro</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Welcome to AccountPro
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{userName}</span> at{" "}
          <span className="font-medium text-slate-900">{organization?.name ?? "Your Organization"}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</div>
              <p className="mt-2 text-sm text-slate-500">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertBanner alerts={alertItems} />

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl text-slate-950">Recent Vouchers (All Clients)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Account Head</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentVouchers ?? []).map((voucher) => {
                const summary = voucherSummaryMap.get(voucher.id) ?? { amount: 0, headName: "—" }
                return (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-medium">{clientNameMap.get(voucher.client_id ?? "") ?? "Client"}</TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${voucher.client_id}/vouchers/${voucher.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        #{voucher.voucher_no}
                      </Link>
                    </TableCell>
                    <TableCell>{voucher.voucher_date}</TableCell>
                    <TableCell>
                      <Badge className="rounded-full bg-slate-100 text-slate-700">{voucher.voucher_type}</Badge>
                    </TableCell>
                    <TableCell>৳{summary.amount.toFixed(2)}</TableCell>
                    <TableCell>{summary.headName}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-950">Client Overview</h2>
          <DashboardQuickActions
            clients={(orgClients ?? []).map((client) => ({ id: client.id, name: client.name }))}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(orgClients ?? [])
            .filter((client) => client.is_active)
            .map((client) => {
              const monthData = thisMonthByClient.get(client.id) ?? { receipts: 0, payments: 0 }
              return (
                <div key={client.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-950">{client.name}</p>
                    <Badge className="rounded-full bg-slate-100 text-slate-700">{client.type ?? "company"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Active fiscal year: {activeFiscalYearMap.get(client.id) ?? "Not set"}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    This month: Receipts {monthData.receipts} | Payments {monthData.payments}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clients/${client.id}/vouchers`}>Vouchers</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clients/${client.id}/ledger`}>Ledger</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clients/${client.id}/reports`}>Reports</Link>
                    </Button>
                  </div>
                </div>
              )
            })}
        </div>
      </Card>
    </div>
  )
}
