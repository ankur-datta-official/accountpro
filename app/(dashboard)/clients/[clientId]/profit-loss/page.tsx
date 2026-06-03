import { notFound } from "next/navigation"

import { ProfitLossManager } from "@/components/reports/profit-loss-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientProfitLossPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
}) {
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
    fiscalYearId: searchParams?.fiscalYear,
  })

  if (!client) notFound()

  if (!selectedFiscalYear) notFound()

  return <ProfitLossManager clientId={client.id} clientName={client.name} fiscalYearId={selectedFiscalYear.id} />
}
