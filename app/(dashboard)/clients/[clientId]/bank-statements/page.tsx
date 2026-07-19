import { notFound } from "next/navigation"

import { BankStatementsManager } from "@/components/reports/bank-statements-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"

export default async function ClientBankStatementsPage({
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
