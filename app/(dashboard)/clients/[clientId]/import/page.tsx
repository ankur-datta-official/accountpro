import { notFound } from "next/navigation"

import { ExcelImportManager } from "@/components/clients/excel-import-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"

export default async function ClientImportPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { client, fiscalYears } = await getClientRouteContext({ clientId: params.clientId })

  if (!client) notFound()

  return (
    <ExcelImportManager
      clientId={client.id}
      fiscalYears={fiscalYears.map((year) => ({ id: year.id, label: year.label }))}
    />
  )
}
