import { cache } from "react"

import type { Database } from "@/lib/types/database"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"]

export type ClientRouteContext = {
  client: Client | null
  fiscalYears: FiscalYear[]
  selectedFiscalYear: FiscalYear | null
}

const getCachedClientRouteContext = cache(async function getCachedClientRouteContext(
  clientId: string,
  fiscalYearId: string
): Promise<ClientRouteContext> {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  if (!client) {
    return {
      client: null,
      fiscalYears: [],
      selectedFiscalYear: null,
    }
  }

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const fiscalYearList = fiscalYears ?? []
  const selectedFiscalYear =
    fiscalYearList.find((year) => year.id === fiscalYearId) ??
    fiscalYearList.find((year) => year.is_active) ??
    fiscalYearList[0] ??
    null

  return {
    client,
    fiscalYears: fiscalYearList,
    selectedFiscalYear,
  }
})

export function getClientRouteContext({
  clientId,
  fiscalYearId,
}: {
  clientId: string
  fiscalYearId?: string | null
}) {
  return getCachedClientRouteContext(clientId, fiscalYearId ?? "")
}
