import { eachMonthOfInterval, format } from "date-fns"
import { notFound } from "next/navigation"

import { VoucherListManager } from "@/components/voucher/voucher-list-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"

export default async function VouchersPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
    fiscalYearId: searchParams.fiscalYear,
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
      paymentModes={(paymentModes ?? []).map((mode) => ({
        id: mode.id,
        name: mode.name,
      }))}
    />
  )
}
