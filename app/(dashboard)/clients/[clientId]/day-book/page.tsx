import { eachMonthOfInterval, format } from "date-fns"
import { notFound } from "next/navigation"

import { DayBookReport, type DayBookRow } from "@/components/reports/day-book-report"
import { getVoucherTypeLabel, isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientDayBookPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
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
    fiscalYears?.find((year) => year.id === searchParams?.fiscalYear) ??
    fiscalYears?.find((year) => year.is_active) ??
    fiscalYears?.[0] ??
    null

  if (!selectedFiscalYear) {
    notFound()
  }

  const [{ data: vouchers }, { data: paymentModes }, { data: groups }, { data: semiSubGroups }, { data: subGroups }, { data: accountHeads }] =
    await Promise.all([
      supabase
        .from("vouchers")
        .select("*")
        .eq("client_id", client.id)
        .eq("fiscal_year_id", selectedFiscalYear.id)
        .order("voucher_date", { ascending: true })
        .order("voucher_no", { ascending: true }),
      supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
      supabase.from("account_groups").select("*").eq("client_id", client.id),
      supabase.from("account_semi_sub_groups").select("*").eq("client_id", client.id),
      supabase.from("account_sub_groups").select("*").eq("client_id", client.id),
      supabase.from("account_heads").select("*").eq("client_id", client.id),
    ])

  const voucherIds = (vouchers ?? []).map((voucher) => voucher.id)
  const { data: entries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] }

  const paymentModeMap = new Map((paymentModes ?? []).map((mode) => [mode.id, mode.name]))
  const voucherMap = new Map((vouchers ?? []).map((voucher) => [voucher.id, voucher]))
  const subGroupMap = new Map((subGroups ?? []).map((subGroup) => [subGroup.id, subGroup]))
  const semiSubGroupMap = new Map((semiSubGroups ?? []).map((semiSubGroup) => [semiSubGroup.id, semiSubGroup]))
  const groupMap = new Map((groups ?? []).map((group) => [group.id, group]))

  const accountHeadDetails = new Map(
    (accountHeads ?? []).map((head) => {
      const subGroup = subGroupMap.get(head.sub_group_id ?? "")
      const semiSubGroup = subGroup ? semiSubGroupMap.get(subGroup.semi_sub_id ?? "") : null
      const group = semiSubGroup ? groupMap.get(semiSubGroup.group_id ?? "") : null

      return [
        head.id,
        {
          name: head.name,
          subGroupName: subGroup?.name ?? "",
          semiSubGroupName: semiSubGroup?.name ?? "",
          groupName: group?.name ?? "",
          openingBalance: Number(head.opening_balance ?? 0),
        },
      ]
    })
  )

  const rows: DayBookRow[] = (entries ?? [])
    .filter((entry) => !isAutoBalanceEntry(entry.description))
    .map((entry) => {
      const voucher = voucherMap.get(entry.voucher_id ?? "")
      const accountHead = accountHeadDetails.get(entry.account_head_id ?? "")

      if (!voucher || !accountHead) {
        return null
      }

      return {
        id: entry.id,
        voucherId: voucher.id,
        accountHeadId: entry.account_head_id ?? "",
        voucherNo: voucher.voucher_no,
        date: voucher.voucher_date,
        accountsGroup: accountHead.groupName || "General",
        semiSubGroup: accountHead.semiSubGroupName,
        subGroup: accountHead.subGroupName,
        accountHead: accountHead.name,
        voucherType: getVoucherTypeLabel(voucher.voucher_type),
        paymentMode: paymentModeMap.get(voucher.payment_mode_id ?? "") ?? "",
        receipt: Number(entry.debit ?? 0),
        payment: Number(entry.credit ?? 0),
        description: entry.description || voucher.description || "",
        month: voucher.month_label ?? format(new Date(voucher.voucher_date), "MMM-yyyy"),
      }
    })
    .filter((row): row is DayBookRow => Boolean(row))

  const months = eachMonthOfInterval({
    start: new Date(selectedFiscalYear.start_date),
    end: new Date(selectedFiscalYear.end_date),
  }).map((month) => format(month, "MMM-yyyy"))

  const cashBankHeadIds = Array.from(accountHeadDetails.entries())
    .filter(([, detail]) => detail.subGroupName === "Cash & Bank Balance")
    .map(([headId]) => headId)

  const openingCashBankBalance = Array.from(accountHeadDetails.entries())
    .filter(([headId]) => cashBankHeadIds.includes(headId))
    .reduce((sum, [, detail]) => sum + detail.openingBalance, 0)

  return (
    <DayBookReport
      clientName={client.name}
      fiscalYearLabel={selectedFiscalYear.label}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
      rows={rows}
      months={months}
      paymentModes={(paymentModes ?? []).map((mode) => ({ id: mode.id, name: mode.name }))}
      openingCashBankBalance={openingCashBankBalance}
      cashBankHeadIds={cashBankHeadIds}
    />
  )
}
