import { notFound } from "next/navigation"

import { ProfitLossManager } from "@/components/reports/profit-loss-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientProfitLossPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams?.fiscalYear,
  })

  if (!client) notFound()

  if (!selectedFiscalYear) notFound()

  return <ProfitLossManager clientId={client.id} clientName={client.name} fiscalYearId={selectedFiscalYear.id} />
}
