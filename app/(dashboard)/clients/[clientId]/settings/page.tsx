import { notFound } from "next/navigation"
import { addYears, format, parseISO } from "date-fns"

import { ClientSettingsManager } from "@/components/clients/client-settings-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientSettingsPage({
  params,
}: {
  params: { clientId: string }
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

  const [
    fiscalYearsRes,
    vouchersRes,
    voucherEntriesRes,
    paymentModesRes,
    accountGroupsRes,
    semiSubGroupsRes,
    subGroupsRes,
    accountHeadsRes,
  ] =
    await Promise.all([
      supabase.from("fiscal_years").select("*").eq("client_id", client.id).order("start_date", { ascending: false }),
      supabase.from("vouchers").select("id,fiscal_year_id").eq("client_id", client.id),
      supabase.from("voucher_entries").select("voucher_id,debit,credit"),
      supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
      supabase.from("account_groups").select("id,name").eq("client_id", client.id),
      supabase.from("account_semi_sub_groups").select("id,group_id").eq("client_id", client.id),
      supabase.from("account_sub_groups").select("id,semi_sub_id").eq("client_id", client.id),
      supabase.from("account_heads").select("id,sub_group_id").eq("client_id", client.id),
    ])

  const vouchers = vouchersRes.data ?? []
  const voucherMap = new Map(vouchers.map((voucher) => [voucher.id, voucher.fiscal_year_id]))
  const fiscalYearVoucherCount = new Map<string, number>()
  const fiscalYearBalance = new Map<string, { debit: number; credit: number }>()

  for (const voucher of vouchers) {
    if (!voucher.fiscal_year_id) continue
    fiscalYearVoucherCount.set(
      voucher.fiscal_year_id,
      (fiscalYearVoucherCount.get(voucher.fiscal_year_id) ?? 0) + 1
    )
  }

  for (const entry of voucherEntriesRes.data ?? []) {
    const fiscalYearId = voucherMap.get(entry.voucher_id ?? "")
    if (!fiscalYearId) continue

    const existing = fiscalYearBalance.get(fiscalYearId) ?? { debit: 0, credit: 0 }
    fiscalYearBalance.set(fiscalYearId, {
      debit: existing.debit + Number(entry.debit ?? 0),
      credit: existing.credit + Number(entry.credit ?? 0),
    })
  }

  const fiscalYears = (fiscalYearsRes.data ?? []).map((year) => {
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

  const accountGroupMap = new Map((accountGroupsRes.data ?? []).map((group) => [group.id, group.name]))
  const semiToGroupMap = new Map((semiSubGroupsRes.data ?? []).map((semi) => [semi.id, semi.group_id]))
  const subToSemiMap = new Map((subGroupsRes.data ?? []).map((sub) => [sub.id, sub.semi_sub_id]))
  const chartHeadCountMap = new Map<string, number>()

  for (const head of accountHeadsRes.data ?? []) {
    if (!head.sub_group_id) continue
    const semiId = subToSemiMap.get(head.sub_group_id)
    const groupId = semiId ? semiToGroupMap.get(semiId) : null
    const groupName = groupId ? accountGroupMap.get(groupId) ?? "Uncategorized" : "Uncategorized"
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
        type: client.type ?? "company",
        tin: client.tin,
        bin: client.bin,
        address: client.address,
        phone: client.phone,
        email: client.email,
        fiscalYearStart: client.fiscal_year_start ?? 7,
      }}
      fiscalYears={fiscalYears}
      nextDefaultStartDate={nextDefaultStartDate}
      paymentModes={(paymentModesRes.data ?? []).map((mode) => ({
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
