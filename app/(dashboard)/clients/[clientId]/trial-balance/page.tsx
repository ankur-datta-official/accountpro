import { notFound } from "next/navigation"

import { TrialBalanceManager } from "@/components/trial-balance/trial-balance-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientTrialBalancePage({
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

  if (!client) {
    notFound()
  }

  if (!selectedFiscalYear) {
    notFound()
  }

  return (
    <TrialBalanceManager
      clientId={client.id}
      clientName={client.name}
      fiscalYearId={selectedFiscalYear.id}
      fiscalYearLabel={selectedFiscalYear.label}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
    />
  )
}
