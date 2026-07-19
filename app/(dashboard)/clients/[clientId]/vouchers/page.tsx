import { eachMonthOfInterval, format } from "date-fns"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

import { VoucherListManager } from "@/components/voucher/voucher-list-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]

export default async function VouchersPage({
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
    fiscalYearId: resolvedSearchParams.fiscalYear,
  })

  if (!client) {
    notFound()
  }

  if (!selectedFiscalYear) {
    notFound()
  }

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .order("name")

  const months = eachMonthOfInterval({
    start: new Date(selectedFiscalYear.start_date),
    end: new Date(selectedFiscalYear.end_date),
  }).map((month) => format(month, "MMM-yyyy"))

  return (
    <VoucherListManager
      clientId={client.id}
      clientName={client.name}
      fiscalYearId={selectedFiscalYear.id}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={format(new Date(), "yyyy-MM-dd")}
      months={months}
      paymentModes={((paymentModes ?? []) as PaymentModeRecord[]).map((mode: PaymentModeRecord) => ({
        id: mode.id,
        name: mode.name,
      }))}
    />
  )
}
