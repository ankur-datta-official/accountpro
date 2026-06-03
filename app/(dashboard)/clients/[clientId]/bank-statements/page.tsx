import { notFound } from "next/navigation"

import { BankStatementsManager } from "@/components/reports/bank-statements-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"

export default async function ClientBankStatementsPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
    fiscalYearId: searchParams?.fiscalYear,
  })

  if (!client) notFound()

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .order("name")

  if (!selectedFiscalYear) notFound()

  return (
    <BankStatementsManager
      clientId={client.id}
      fiscalYearId={selectedFiscalYear.id}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
      paymentModes={(paymentModes ?? []).map((mode) => ({ id: mode.id, name: mode.name }))}
    />
  )
}
