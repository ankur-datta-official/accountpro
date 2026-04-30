import { notFound } from "next/navigation"

import { ExcelImportManager } from "@/components/clients/excel-import-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientImportPage({
  params,
}: {
  params: { clientId: string }
}) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  if (!client) notFound()

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  return (
    <ExcelImportManager
      clientId={client.id}
      fiscalYears={(fiscalYears ?? []).map((year) => ({ id: year.id, label: year.label }))}
    />
  )
}
