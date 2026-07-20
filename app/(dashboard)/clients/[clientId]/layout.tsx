import { notFound } from "next/navigation"
import { FiscalYearProvider } from "@/components/clients/fiscal-year-context"
import { findFiscalYearForDate, getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}>) {
  const resolvedParams = await params
  const { client, fiscalYears, routeSegment } = await getClientRouteContext({ clientId: resolvedParams.clientId })

  if (!client) {
    notFound()
  }

  const initialFiscalYearId =
    findFiscalYearForDate(fiscalYears)?.id ??
    fiscalYears.find((year) => year.is_active)?.id ??
    fiscalYears[0]?.id ??
    null

  return (
    <FiscalYearProvider
      clientId={client.id}
      fiscalYears={fiscalYears.map((year) => ({ id: year.id, label: year.label }))}
      initialFiscalYearId={initialFiscalYearId}
    >
      <div data-client-route-segment={routeSegment ?? client.id}>{children}</div>
    </FiscalYearProvider>
  )
}
