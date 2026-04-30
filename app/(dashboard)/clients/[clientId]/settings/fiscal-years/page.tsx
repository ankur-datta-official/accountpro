import { addYears, format, parseISO } from "date-fns"
import { notFound } from "next/navigation"

import { FiscalYearForm } from "@/components/clients/FiscalYearForm"
import {
  CloseFiscalYearButton,
  SetActiveFiscalYearButton,
} from "@/components/clients/fiscal-year-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

function getFiscalYearStatus(year: {
  is_active: boolean | null
  is_closed: boolean | null
}) {
  if (year.is_closed) {
    return { label: "Closed", className: "bg-slate-100 text-slate-600 hover:bg-slate-100" }
  }

  if (year.is_active) {
    return { label: "Active", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" }
  }

  return { label: "Future", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" }
}

export default async function FiscalYearsPage({
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

  if (!client) {
    notFound()
  }

  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", client.id)
    .order("start_date", { ascending: false })

  const latestStartDate =
    fiscalYears?.[0]?.start_date ?? format(new Date(new Date().getFullYear(), 6, 1), "yyyy-MM-dd")

  const nextDefaultStartDate = format(addYears(parseISO(latestStartDate), 1), "yyyy-MM-dd")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Fiscal Years</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Manage active, closed, and upcoming reporting periods for this client.
          </p>
        </div>
        <FiscalYearForm
          clientId={client.id}
          existingYears={(fiscalYears ?? []).map((year) => ({
            id: year.id,
            start_date: year.start_date,
            end_date: year.end_date,
          }))}
          defaultStartDate={nextDefaultStartDate}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(fiscalYears ?? []).map((year) => {
          const status = getFiscalYearStatus(year)

          return (
            <Card key={year.id} className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                    {year.label}
                  </CardTitle>
                  <p className="mt-2 text-sm text-slate-500">
                    {format(parseISO(year.start_date), "dd MMM yyyy")} to{" "}
                    {format(parseISO(year.end_date), "dd MMM yyyy")}
                  </p>
                </div>
                <Badge className={`rounded-full ${status.className}`}>{status.label}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <SetActiveFiscalYearButton
                  clientId={client.id}
                  fiscalYearId={year.id}
                  disabled={Boolean(year.is_active)}
                />
                <CloseFiscalYearButton
                  clientId={client.id}
                  fiscalYearId={year.id}
                  disabled={Boolean(year.is_closed)}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
