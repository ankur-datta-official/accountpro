import { notFound } from "next/navigation"
import { addYears, format, parseISO } from "date-fns"

import { ClientSettingsManager } from "@/components/clients/client-settings-manager"
import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type VoucherRecord = Database["public"]["Tables"]["vouchers"]["Row"]
type VoucherEntryRecord = Database["public"]["Tables"]["voucher_entries"]["Row"]
type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]
type AccountHeadRecord = Database["public"]["Tables"]["account_heads"]["Row"]
type FiscalYearRecord = Database["public"]["Tables"]["fiscal_years"]["Row"]

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const resolvedParams = await params
  const supabase = await createClient()
  const { client, fiscalYears: routeFiscalYears } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
  })

  if (!client) {
    notFound()
  }

  const [
    fiscalYearsRes,
    vouchersRes,
    voucherEntriesRes,
    paymentModesRes,
    accountHeadsRes,
    groupsRes,
    semiSubGroupsRes,
    subGroupsRes,
  ] =
    await Promise.all([
      Promise.resolve({ data: routeFiscalYears }),
      supabase.from("vouchers").select("id,fiscal_year_id").eq("client_id", client.id),
      supabase.from("voucher_entries").select("voucher_id,debit,credit"),
      supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
      supabase.from("account_heads").select("*").eq("client_id", client.id),
      supabase.from("account_groups").select("*").eq("client_id", client.id),
      supabase.from("account_semi_sub_groups").select("*").eq("client_id", client.id),
      supabase.from("account_sub_groups").select("*").eq("client_id", client.id),
    ])

  const vouchers = (vouchersRes.data ?? []) as VoucherRecord[]
  const voucherMap = new Map<string, string | null>(
    vouchers.map((voucher: VoucherRecord) => [voucher.id, voucher.fiscal_year_id])
  )
  const fiscalYearVoucherCount = new Map<string, number>()
  const fiscalYearBalance = new Map<string, { debit: number; credit: number }>()

  for (const voucher of vouchers) {
    if (!voucher.fiscal_year_id) continue
    fiscalYearVoucherCount.set(
      voucher.fiscal_year_id,
      (fiscalYearVoucherCount.get(voucher.fiscal_year_id) ?? 0) + 1
    )
  }

  for (const entry of (voucherEntriesRes.data ?? []) as VoucherEntryRecord[]) {
    const fiscalYearId = voucherMap.get(entry.voucher_id ?? "")
    if (!fiscalYearId) continue

    const existing = fiscalYearBalance.get(fiscalYearId) ?? { debit: 0, credit: 0 }
    fiscalYearBalance.set(fiscalYearId, {
      debit: existing.debit + Number(entry.debit ?? 0),
      credit: existing.credit + Number(entry.credit ?? 0),
    })
  }

  const fiscalYears = (fiscalYearsRes.data ?? []).map((year: FiscalYearRecord) => {
    const totals = fiscalYearBalance.get(year.id) ?? { debit: 0, credit: 0 }
    return {
      id: year.id,
      label: year.label,
      startDate: year.start_date,
      endDate: year.end_date,
      isActive: Boolean(year.is_active),
      isClosed: Boolean(year.is_closed),
      voucherCount: fiscalYearVoucherCount.get(year.id) ?? 0,
      isBalanced: Math.abs(totals.debit - totals.credit) < 0.0001,
    }
  })

  const chartHeadCountMap = new Map<string, number>()
  const allAccountHeads = (accountHeadsRes.data ?? []) as AccountHeadRecord[]

  for (const head of allAccountHeads) {
    const hierarchy = resolveAccountHierarchy(head, {
      accountHeads: allAccountHeads,
      groups: (groupsRes.data ?? []) as Database["public"]["Tables"]["account_groups"]["Row"][],
      semiSubGroups: (semiSubGroupsRes.data ?? []) as Database["public"]["Tables"]["account_semi_sub_groups"]["Row"][],
      subGroups: (subGroupsRes.data ?? []) as Database["public"]["Tables"]["account_sub_groups"]["Row"][],
    })
    const groupName = hierarchy.groupName || "Uncategorized"
    chartHeadCountMap.set(groupName, (chartHeadCountMap.get(groupName) ?? 0) + 1)
  }

  const latestStartDate =
    (fiscalYearsRes.data ?? [])[0]?.start_date ?? format(new Date(new Date().getFullYear(), 6, 1), "yyyy-MM-dd")
  const nextDefaultStartDate = format(addYears(parseISO(latestStartDate), 1), "yyyy-MM-dd")

  const chartStats = Array.from(chartHeadCountMap.entries()).map(([groupName, totalHeads]) => ({
    groupName,
    totalHeads,
  }))

  return (
    <ClientSettingsManager
      clientId={client.id}
      initialClient={{
        name: client.name,
        type: client.type ?? "limited_company_commercial",
        tin: client.tin,
        bin: client.bin,
        address: client.address,
        phone: client.phone,
        email: client.email,
        fiscalYearStart: client.fiscal_year_start ?? 7,
      }}
      fiscalYears={fiscalYears}
      nextDefaultStartDate={nextDefaultStartDate}
      paymentModes={((paymentModesRes.data ?? []) as PaymentModeRecord[]).map((mode: PaymentModeRecord) => ({
        id: mode.id,
        name: mode.name,
        type: mode.type,
        accountNo: mode.account_no,
        isActive: Boolean(mode.is_active),
      }))}
      chartStats={chartStats}
    />
  )
}
