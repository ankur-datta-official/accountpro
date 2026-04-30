import { eachMonthOfInterval, format } from "date-fns"
import { notFound } from "next/navigation"

import { VoucherListManager } from "@/components/voucher/voucher-list-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function VouchersPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams: { fiscalYear?: string }
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
    fiscalYears?.find((year) => year.id === searchParams.fiscalYear) ??
    fiscalYears?.find((year) => year.is_active) ??
    fiscalYears?.[0] ??
    null

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
