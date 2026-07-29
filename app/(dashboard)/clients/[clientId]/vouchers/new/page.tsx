import { notFound, redirect } from "next/navigation"

import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { findFiscalYearForDate, getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]
type DashboardVoucherType = "payment" | "received" | "journal" | "contra" | "bf" | "bp" | "br"

function parseVoucherType(value: string | undefined): DashboardVoucherType | undefined {
  if (!value) {
    return undefined
  }

  const validTypes = new Set<DashboardVoucherType>(["payment", "received", "journal", "contra", "bf", "bp", "br"])
  return validTypes.has(value as DashboardVoucherType) ? (value as DashboardVoucherType) : undefined
}

export default async function NewVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string; voucherType?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { client, fiscalYears, selectedFiscalYear } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams.fiscalYear,
  })

  if (!client) {
    notFound()
  }

  if (!selectedFiscalYear) {
    notFound()
  }

  const currentFiscalYear = findFiscalYearForDate(fiscalYears)
  const effectiveFiscalYear =
    currentFiscalYear && currentFiscalYear.id !== selectedFiscalYear.id
      ? currentFiscalYear
      : selectedFiscalYear

  if (effectiveFiscalYear.id !== selectedFiscalYear.id) {
    redirect(`/clients/${resolvedParams.clientId}/vouchers/new?fiscalYear=${effectiveFiscalYear.id}`)
  }

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("voucher_type")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", effectiveFiscalYear.id)

  const voucherTypeCounts = (vouchers ?? []).reduce<Record<string, number>>((acc, voucher) => {
    const key = voucher.voucher_type
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("name")

  const initialVoucherType = parseVoucherType(resolvedSearchParams.voucherType)

  return (
    <div className="space-y-6">
      <VoucherEntryForm
        clientId={client.id}
        fiscalYearId={effectiveFiscalYear.id}
        fiscalYearStartDate={effectiveFiscalYear.start_date}
        fiscalYearEndDate={effectiveFiscalYear.end_date}
        defaultVoucherNo={1}
        defaultVoucherNoByType={{
          payment: (voucherTypeCounts.payment ?? 0) + 1,
          received: (voucherTypeCounts.received ?? 0) + 1,
          journal: (voucherTypeCounts.journal ?? 0) + 1,
          contra: (voucherTypeCounts.contra ?? 0) + 1,
          bf: (voucherTypeCounts.bf ?? 0) + 1,
          bp: (voucherTypeCounts.bp ?? 0) + 1,
          br: (voucherTypeCounts.br ?? 0) + 1,
        }}
        paymentModes={((paymentModes ?? []) as PaymentModeRecord[]).map((mode: PaymentModeRecord) => ({
          id: mode.id,
          name: mode.name,
          type: mode.type,
          accountHeadId: mode.account_head_id,
        }))}
        initialValues={initialVoucherType ? { voucherType: initialVoucherType } : undefined}
      />
    </div>
  )
}
