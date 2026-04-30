import { ClientsTable, type ClientTableRow } from "@/components/clients/clients-table"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientsPage() {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: clients } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
    : { data: [] }

  const clientIds = clients?.map((client) => client.id) ?? []

  const { data: fiscalYears } = clientIds.length
    ? await supabase
        .from("fiscal_years")
        .select("*")
        .in("client_id", clientIds)
        .eq("is_active", true)
    : { data: [] }

  const activeFiscalYearMap = new Map(
    (fiscalYears ?? []).map((year) => [year.client_id, year.label])
  )

  const rows: ClientTableRow[] = (clients ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    type: client.type ?? "company",
    tin: client.tin,
    bin: client.bin,
    fiscalYearLabel: activeFiscalYearMap.get(client.id) ?? "Not initialized",
    isActive: Boolean(client.is_active),
  }))

  return <ClientsTable data={rows} />
}
