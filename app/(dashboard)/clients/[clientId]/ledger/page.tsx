import { notFound } from "next/navigation"

import { LedgerBookManager } from "@/components/ledger/ledger-book-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientLedgerPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
}) {
  const { client, fiscalYears, selectedFiscalYear } = await getClientRouteContext({
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
    <LedgerBookManager
      clientId={client.id}
      clientName={client.name}
      fiscalYears={fiscalYears.map((year) => ({
        id: year.id,
        label: year.label,
        start_date: year.start_date,
        end_date: year.end_date,
      }))}
      selectedFiscalYearId={selectedFiscalYear.id}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
    />
  )
}
