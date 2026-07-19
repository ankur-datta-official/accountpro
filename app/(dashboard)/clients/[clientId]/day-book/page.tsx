import { eachMonthOfInterval, format } from "date-fns"
import { notFound } from "next/navigation"

import { DayBookReport, type DayBookRow } from "@/components/reports/day-book-report"
import { resolveAccountHierarchy } from "@/lib/accounting/chart-hierarchy"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { getVoucherTypeLabel, isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type VoucherRecord = Database["public"]["Tables"]["vouchers"]["Row"]
type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]
type AccountHeadRecord = Database["public"]["Tables"]["account_heads"]["Row"]
type VoucherEntryRecord = Database["public"]["Tables"]["voucher_entries"]["Row"]
type AccountHeadDetail = {
  name: string
  subGroupName: string
  semiSubGroupName: string
  groupName: string
  openingBalance: number
  path: string[]
}

export default async function ClientDayBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams?.fiscalYear,
  })

  if (!client) {
    notFound()
  }

  if (!selectedFiscalYear) {
    notFound()
  }

  const [{ data: vouchers }, { data: paymentModes }, { data: _groups }, { data: _semiSubGroups }, { data: _subGroups }, { data: accountHeads }] =
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

  const voucherRows = (vouchers ?? []) as VoucherRecord[]
  const paymentModeRows = (paymentModes ?? []) as PaymentModeRecord[]
  const accountHeadRows = (accountHeads ?? []) as AccountHeadRecord[]

  const voucherIds = voucherRows.map((voucher: VoucherRecord) => voucher.id)
  const { data: entries } = voucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", voucherIds)
    : { data: [] as VoucherEntryRecord[] }

  const paymentModeMap = new Map<string, string>(paymentModeRows.map((mode: PaymentModeRecord) => [mode.id, mode.name]))
  const voucherMap = new Map<string, VoucherRecord>(voucherRows.map((voucher: VoucherRecord) => [voucher.id, voucher]))
  const accountHeadDetails = new Map(
    accountHeadRows.map((head: AccountHeadRecord) => {
      const hierarchy = resolveAccountHierarchy(head, {
        accountHeads: accountHeadRows,
        groups: (_groups ?? []) as Database["public"]["Tables"]["account_groups"]["Row"][],
        semiSubGroups: (_semiSubGroups ?? []) as Database["public"]["Tables"]["account_semi_sub_groups"]["Row"][],
        subGroups: (_subGroups ?? []) as Database["public"]["Tables"]["account_sub_groups"]["Row"][],
      })
      
      return [
        head.id,
        {
          name: head.name,
          subGroupName: hierarchy.subGroupName,
          semiSubGroupName: hierarchy.semiSubGroupName,
          groupName: hierarchy.groupName || "General",
          openingBalance: Number(head.opening_balance ?? 0),
          path: hierarchy.path,
        },
      ]
    })
  )

  const rows: DayBookRow[] = (entries ?? [])
    .filter((entry: VoucherEntryRecord) => !isAutoBalanceEntry(entry.description))
    .map((entry: VoucherEntryRecord) => {
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
    .filter((row: DayBookRow | null): row is DayBookRow => Boolean(row))

  const months = eachMonthOfInterval({
    start: new Date(selectedFiscalYear.start_date),
    end: new Date(selectedFiscalYear.end_date),
  }).map((month) => format(month, "MMM-yyyy"))

  const cashBankHeadIds = Array.from(accountHeadDetails.entries())
    .filter(([, detail]: [string, AccountHeadDetail]) =>
      detail.path.some(
        (segment: string) =>
          segment.includes("Cash & Bank Balance") ||
          segment.includes("Cash") ||
          segment.includes("Bank")
      )
    )
    .map(([headId]) => headId)

  const openingCashBankBalance = Array.from(accountHeadDetails.entries())
    .filter(([headId]: [string, AccountHeadDetail]) => cashBankHeadIds.includes(headId))
    .reduce(
      (sum: number, [, detail]: [string, AccountHeadDetail]) => sum + detail.openingBalance,
      0
    )

  return (
    <DayBookReport
      clientName={client.name}
      fiscalYearLabel={selectedFiscalYear.label}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
      rows={rows}
      months={months}
      paymentModes={paymentModeRows.map((mode: PaymentModeRecord) => ({ id: mode.id, name: mode.name }))}
      openingCashBankBalance={openingCashBankBalance}
      cashBankHeadIds={cashBankHeadIds}
    />
  )
}
