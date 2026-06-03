import { notFound } from "next/navigation"

import { TrialBalanceManager } from "@/components/trial-balance/trial-balance-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientTrialBalancePage({
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
