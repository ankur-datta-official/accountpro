import { notFound } from "next/navigation"

import { SalaryCertificateManager } from "@/components/reports/salary-certificate-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import {
  isMissingSalaryCertificateSchemaError,
  listSalaryCertificates,
} from "@/lib/salary-certificates/service"
import type { Database } from "@/lib/types"

type EmployeeRow = Database["public"]["Tables"]["payroll_employees"]["Row"]

export default async function SalaryCertificatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ fiscalYear?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { client, selectedFiscalYear, fiscalYears } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
    fiscalYearId: resolvedSearchParams.fiscalYear,
  })

  if (!client || !selectedFiscalYear) {
    notFound()
  }

  const { data: employees, error } = await supabase
    .from("payroll_employees")
    .select("*")
    .eq("client_id", client.id)
    .order("name")

  if (error) {
    throw new Error(error.message || "Unable to load payroll employees.")
  }

  let schemaReady = true
  let history = [] as Awaited<ReturnType<typeof listSalaryCertificates>>

  try {
    history = await listSalaryCertificates(supabase, client.id, selectedFiscalYear.id)
  } catch (historyError) {
    const message = historyError instanceof Error ? historyError.message : ""
    if (isMissingSalaryCertificateSchemaError(message)) {
      schemaReady = false
    } else {
      throw historyError
    }
  }

  return (
    <SalaryCertificateManager
      clientId={client.id}
      clientName={client.trade_name || client.name}
      schemaReady={schemaReady}
      selectedFiscalYearId={selectedFiscalYear.id}
      fiscalYears={fiscalYears.map((year) => ({ id: year.id, label: year.label }))}
      employees={((employees ?? []) as EmployeeRow[]).map((employee) => ({
        id: employee.id,
        name: employee.name,
        employeeCode: employee.employee_code,
        designation: employee.designation,
      }))}
      initialHistory={history}
    />
  )
}
