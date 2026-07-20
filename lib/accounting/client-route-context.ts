import { cache } from "react"

import {
  buildClientRouteSegment,
  isUuid,
  matchesClientRouteSegment,
} from "@/lib/routing/clients"
import { getCurrentDateInAppTimeZone } from "@/lib/dates/current-date"
import type { Database } from "@/lib/types/database"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

type Client = Database["public"]["Tables"]["clients"]["Row"]
type FiscalYear = Database["public"]["Tables"]["fiscal_years"]["Row"]

export type ClientRouteContext = {
  client: Client | null
  routeSegment: string | null
  fiscalYears: FiscalYear[]
  selectedFiscalYear: FiscalYear | null
}

function getTodayDateOnly() {
  return getCurrentDateInAppTimeZone()
}

export function findFiscalYearForDate(
  fiscalYears: FiscalYear[],
  targetDate = getTodayDateOnly()
) {
  return (
    fiscalYears.find((year) => {
      if (!year.start_date || !year.end_date) {
        return false
      }

      return year.start_date <= targetDate && targetDate <= year.end_date
    }) ?? null
  )
}

const getCachedClientRouteContext = cache(async function getCachedClientRouteContext(
  clientId: string,
  fiscalYearId: string
): Promise<ClientRouteContext> {
  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()

  let client: Client | null = null

  if (membership?.org_id) {
    if (isUuid(clientId)) {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
      client = data ?? null
    } else {
      const { data } = await supabase.from("clients").select("*").eq("org_id", membership.org_id)
      const clientRows = (data ?? []) as Client[]
      client = clientRows.find((candidate) => matchesClientRouteSegment(candidate, clientId)) ?? null
    }
  }

  if (!client) {
    return {
      client: null,
      routeSegment: null,
      fiscalYears: [],
      selectedFiscalYear: null,
    }
  }

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const fiscalYearList: FiscalYear[] = fiscalYears ?? []
  const currentFiscalYear = findFiscalYearForDate(fiscalYearList)
  const selectedFiscalYear =
    fiscalYearList.find((year: FiscalYear) => year.id === fiscalYearId) ??
    currentFiscalYear ??
    fiscalYearList.find((year: FiscalYear) => year.is_active) ??
    fiscalYearList[0] ??
    null

  return {
    client,
    routeSegment: buildClientRouteSegment(client),
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
