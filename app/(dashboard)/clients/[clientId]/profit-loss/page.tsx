import { notFound } from "next/navigation"

import { ProfitLossManager } from "@/components/reports/profit-loss-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientProfitLossPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase.from("clients").select("*").eq("id", params.clientId).eq("org_id", membership.org_id).maybeSingle()
    : { data: null }

  if (!client) notFound()

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const selectedFiscalYear =
    fiscalYears?.find((year) => year.id === searchParams?.fiscalYear) ??
    fiscalYears?.find((year) => year.is_active) ??
    fiscalYears?.[0] ??
    null

  if (!selectedFiscalYear) notFound()

  return <ProfitLossManager clientId={client.id} clientName={client.name} fiscalYearId={selectedFiscalYear.id} />
}
