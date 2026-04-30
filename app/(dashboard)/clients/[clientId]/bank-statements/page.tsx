import { notFound } from "next/navigation"

import { BankStatementsManager } from "@/components/reports/bank-statements-manager"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function ClientBankStatementsPage({
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

  const [{ data: fiscalYears }, { data: paymentModes }] = await Promise.all([
    supabase.from("fiscal_years").select("*").eq("client_id", client.id).order("start_date", { ascending: false }),
    supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
  ])

  const selectedFiscalYear =
    fiscalYears?.find((year) => year.id === searchParams?.fiscalYear) ??
    fiscalYears?.find((year) => year.is_active) ??
    fiscalYears?.[0] ??
    null

  if (!selectedFiscalYear) notFound()

  return (
    <BankStatementsManager
      clientId={client.id}
      fiscalYearId={selectedFiscalYear.id}
      defaultFrom={selectedFiscalYear.start_date}
      defaultTo={selectedFiscalYear.end_date}
      paymentModes={(paymentModes ?? []).map((mode) => ({ id: mode.id, name: mode.name }))}
    />
  )
}
