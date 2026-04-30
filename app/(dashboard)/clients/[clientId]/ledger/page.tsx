import { notFound } from "next/navigation"

import { LedgerBookManager } from "@/components/ledger/ledger-book-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientLedgerPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams?: { fiscalYear?: string }
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

  if (!client) {
    notFound()
  }

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

  if (!selectedFiscalYear) {
    notFound()
  }

  return (
    <LedgerBookManager
      clientId={client.id}
      clientName={client.name}
      fiscalYears={(fiscalYears ?? []).map((year) => ({
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
