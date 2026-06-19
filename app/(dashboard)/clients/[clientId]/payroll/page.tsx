import { notFound } from "next/navigation"

import { PayrollManager } from "@/components/payroll/payroll-manager"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { ensurePayrollDefaultsAction } from "@/lib/actions/payroll"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type PayrollRunItem = Database["public"]["Tables"]["payroll_run_items"]["Row"]

function isMissingPayrollSchemaError(message?: string | null) {
  if (!message) return false
  return message.includes("payroll_employees") || message.includes("schema cache")
}

function amount(value: number | null | undefined) {
  return Number(value ?? 0)
}

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
    fiscalYearId: searchParams.fiscalYear,
  })

  if (!client || !selectedFiscalYear) {
    notFound()
  }

  const [
    employeesResult,
    salaryResult,
    runsResult,
    paymentModesResult,
    mappingsResult,
  ] = await Promise.all([
    supabase
      .from("payroll_employees")
      .select("*")
      .eq("client_id", client.id)
      .order("name"),
    supabase
      .from("payroll_salary_structures")
      .select("*")
      .eq("client_id", client.id),
    supabase
      .from("payroll_runs")
      .select("*")
      .eq("client_id", client.id)
      .eq("fiscal_year_id", selectedFiscalYear.id)
      .order("period_start", { ascending: false }),
    supabase
      .from("payment_modes")
      .select("*")
      .eq("client_id", client.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("payroll_account_mappings")
      .select("*")
      .eq("client_id", client.id),
  ])

  const schemaReady = ![
    employeesResult.error,
    salaryResult.error,
    runsResult.error,
    mappingsResult.error,
  ].some((error) => isMissingPayrollSchemaError(error?.message))

  if (schemaReady && !(mappingsResult.data ?? []).length) {
    const defaultsResult = await ensurePayrollDefaultsAction({ clientId: client.id })
    if (defaultsResult.success) {
      const refreshedMappings = await supabase
        .from("payroll_account_mappings")
        .select("*")
        .eq("client_id", client.id)
      mappingsResult.data = refreshedMappings.data ?? []
    }
  }

  const salariesByEmployee = new Map(
    (salaryResult.data ?? []).map((salary) => [salary.employee_id, salary])
  )
  const employees = (employeesResult.data ?? []).map((employee) => ({
    ...employee,
    salary: salariesByEmployee.get(employee.id) ?? null,
  }))

  const payrollRuns = runsResult.data ?? []
  const runIds = payrollRuns.map((run) => run.id)
  const voucherIds = Array.from(
    new Set(
      payrollRuns
        .flatMap((run) => [run.accrual_voucher_id, run.payment_voucher_id])
        .filter(Boolean) as string[]
    )
  )
  const mappingHeadIds = (mappingsResult.data ?? []).map((mapping) => mapping.account_head_id)

  const [itemsResult, vouchersResult, accountHeadsResult] = await Promise.all([
    runIds.length
      ? supabase.from("payroll_run_items").select("*").in("payroll_run_id", runIds)
      : Promise.resolve({ data: [] }),
    voucherIds.length
      ? supabase.from("vouchers").select("id,voucher_no").in("id", voucherIds)
      : Promise.resolve({ data: [] }),
    mappingHeadIds.length
      ? supabase.from("account_heads").select("id,name").in("id", mappingHeadIds)
      : Promise.resolve({ data: [] }),
  ])

  const voucherNoById = new Map((vouchersResult.data ?? []).map((voucher) => [voucher.id, voucher.voucher_no]))
  const accountHeadNameById = new Map((accountHeadsResult.data ?? []).map((head) => [head.id, head.name]))
  const payrollItems = (itemsResult.data ?? []) as PayrollRunItem[]
  const itemsByRun = new Map<string, PayrollRunItem[]>()

  for (const item of payrollItems) {
    const current = itemsByRun.get(item.payroll_run_id) ?? []
    current.push(item)
    itemsByRun.set(item.payroll_run_id, current)
  }

  const runs = payrollRuns.map((run) => {
    const items = itemsByRun.get(run.id) ?? []
    const totals = items.reduce(
      (acc, item) => {
        acc.grossSalary += amount(item.gross_salary)
        acc.totalAdditions += amount(item.total_additions)
        acc.totalDeductions += amount(item.total_deductions)
        acc.netPayable += amount(item.net_payable)
        return acc
      },
      {
        grossSalary: 0,
        totalAdditions: 0,
        totalDeductions: 0,
        netPayable: 0,
      }
    )

    return {
      ...run,
      accrual_voucher_no: run.accrual_voucher_id ? voucherNoById.get(run.accrual_voucher_id) ?? null : null,
      payment_voucher_no: run.payment_voucher_id ? voucherNoById.get(run.payment_voucher_id) ?? null : null,
      totals,
    }
  })

  const accountMappings = (mappingsResult.data ?? []).map((mapping) => ({
    component_code: mapping.component_code,
    account_head_id: mapping.account_head_id,
    account_head_name: accountHeadNameById.get(mapping.account_head_id) ?? "Missing account head",
  }))

  return (
    <PayrollManager
      clientId={client.id}
      fiscalYearId={selectedFiscalYear.id}
      fiscalYearLabel={selectedFiscalYear.label}
      fiscalYearStart={selectedFiscalYear.start_date}
      schemaReady={schemaReady}
      employees={employees}
      payrollRuns={runs}
      paymentModes={(paymentModesResult.data ?? []).map((mode) => ({
        id: mode.id,
        name: mode.name,
        type: mode.type,
      }))}
      accountMappings={accountMappings}
    />
  )
}
