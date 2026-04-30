import { notFound } from "next/navigation"

import { OpeningBalanceForm } from "@/components/voucher/opening-balance-form"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function OpeningBalancePage({
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

  const previousFiscalYear =
    fiscalYears?.find((year) => year.end_date < selectedFiscalYear.start_date) ?? null

  const [{ data: groups }, { data: semiSubGroups }, { data: subGroups }, { data: accountHeads }] =
    await Promise.all([
      supabase.from("account_groups").select("*").eq("client_id", client.id),
      supabase.from("account_semi_sub_groups").select("*").eq("client_id", client.id),
      supabase.from("account_sub_groups").select("*").eq("client_id", client.id),
      supabase
        .from("account_heads")
        .select("*")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .order("name"),
    ])

  const openingVoucherQuery = supabase
    .from("vouchers")
    .select("*")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .eq("voucher_type", "bf")
    .limit(1)

  const [{ data: existingOpeningVoucher }, previousYearVouchersResult] = await Promise.all([
    openingVoucherQuery.maybeSingle(),
    previousFiscalYear
      ? supabase
          .from("vouchers")
          .select("*")
          .eq("client_id", client.id)
          .eq("fiscal_year_id", previousFiscalYear.id)
      : Promise.resolve({ data: [] }),
  ])

  const existingOpeningVoucherId = existingOpeningVoucher?.id ?? null
  const previousYearVoucherIds = (previousYearVouchersResult.data ?? []).map((voucher) => voucher.id)
  const previousYearEntriesResult = previousYearVoucherIds.length
    ? await supabase.from("voucher_entries").select("*").in("voucher_id", previousYearVoucherIds)
    : { data: [] }
  const existingOpeningEntriesResult = existingOpeningVoucherId
    ? await supabase.from("voucher_entries").select("*").eq("voucher_id", existingOpeningVoucherId)
    : { data: [] }

  const subGroupMap = new Map((subGroups ?? []).map((subGroup) => [subGroup.id, subGroup]))
  const semiSubGroupMap = new Map(
    (semiSubGroups ?? []).map((semiSubGroup) => [semiSubGroup.id, semiSubGroup])
  )
  const groupMap = new Map((groups ?? []).map((group) => [group.id, group]))
  const previousVoucherMap = new Map(
    (previousYearVouchersResult.data ?? []).map((voucher) => [voucher.id, voucher])
  )

  const existingOpeningEntriesMap = new Map(
    (existingOpeningEntriesResult.data ?? []).map((entry) => [entry.account_head_id ?? "", entry])
  )

  const previousClosingMap = new Map<string, number>()

  for (const head of accountHeads ?? []) {
    const openingBalance = Number(head.opening_balance ?? 0)
    const openingSigned = (head.balance_type ?? "debit") === "credit" ? -openingBalance : openingBalance
    previousClosingMap.set(head.id, openingSigned)
  }

  for (const entry of previousYearEntriesResult.data ?? []) {
    const headId = entry.account_head_id ?? ""

    if (!headId) {
      continue
    }

    const running = previousClosingMap.get(headId) ?? 0
    const voucher = previousVoucherMap.get(entry.voucher_id ?? "")

    if (!voucher) {
      continue
    }

    previousClosingMap.set(
      headId,
      running + Number(entry.debit ?? 0) - Number(entry.credit ?? 0)
    )
  }

  const lines = (accountHeads ?? [])
    .map((head) => {
      const subGroup = subGroupMap.get(head.sub_group_id ?? "")
      const semiSubGroup = subGroup ? semiSubGroupMap.get(subGroup.semi_sub_id ?? "") : null
      const group = semiSubGroup ? groupMap.get(semiSubGroup.group_id ?? "") : null

      if (!group || !["asset", "liability"].includes(group.type)) {
        return null
      }

      const existingEntry = existingOpeningEntriesMap.get(head.id)
      const previousClosing = previousClosingMap.get(head.id) ?? 0
      const signedValue = existingEntry
        ? Number(existingEntry.debit ?? 0) - Number(existingEntry.credit ?? 0)
        : previousClosing
      const section =
        subGroup?.name === "Cash & Bank Balance"
          ? "cash-bank"
          : group.type === "asset"
            ? "asset"
            : "liability"

      return {
        accountHeadId: head.id,
        accountHeadName: head.name,
        accountsGroup: group.type as "asset" | "liability",
        section,
        debitAmount: signedValue > 0 ? Number(signedValue.toFixed(2)) : 0,
        creditAmount: signedValue < 0 ? Number(Math.abs(signedValue).toFixed(2)) : 0,
      }
    })
    .filter(
      (
        line
      ): line is {
        accountHeadId: string
        accountHeadName: string
        accountsGroup: "asset" | "liability"
        section: "cash-bank" | "asset" | "liability"
        debitAmount: number
        creditAmount: number
      } => Boolean(line)
    )
    .sort((left, right) => left.accountHeadName.localeCompare(right.accountHeadName))

  return (
    <OpeningBalanceForm
      clientId={client.id}
      fiscalYearId={selectedFiscalYear.id}
      fiscalYearLabel={selectedFiscalYear.label}
      hasExistingOpeningBalances={Boolean(existingOpeningVoucher)}
      initialLines={lines}
    />
  )
}
