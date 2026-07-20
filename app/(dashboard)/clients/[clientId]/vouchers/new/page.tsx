import { notFound, redirect } from "next/navigation"

import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { findFiscalYearForDate, getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]

export default async function NewVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
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
    .select("voucher_no")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", effectiveFiscalYear.id)
    .order("voucher_no", { ascending: false })
    .limit(1)

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("name")

  return (
    <div className="space-y-6">
      <VoucherEntryForm
        clientId={client.id}
        fiscalYearId={effectiveFiscalYear.id}
        fiscalYearStartDate={effectiveFiscalYear.start_date}
        fiscalYearEndDate={effectiveFiscalYear.end_date}
        defaultVoucherNo={Number(vouchers?.[0]?.voucher_no ?? 0) + 1}
        paymentModes={((paymentModes ?? []) as PaymentModeRecord[]).map((mode: PaymentModeRecord) => ({
        id: mode.id,
        name: mode.name,
        type: mode.type,
      }))}
      />
    </div>
  )
}
