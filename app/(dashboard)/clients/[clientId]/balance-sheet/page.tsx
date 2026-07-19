import { notFound } from "next/navigation"

import { BalanceSheetManager } from "@/components/balance-sheet/balance-sheet-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientBalanceSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const { client, fiscalYears, selectedFiscalYear } = await getClientRouteContext({
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
    <BalanceSheetManager
      clientId={client.id}
      clientName={client.name}
      fiscalYears={fiscalYears.map((year) => ({
        id: year.id,
        label: year.label,
      }))}
      selectedFiscalYearId={selectedFiscalYear.id}
    />
  )
}
