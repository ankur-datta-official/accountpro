import { format } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  aggregateAnnualPayroll,
  buildAssessmentYearLabel,
  buildSalaryCertificateNumber,
  validateSalaryCertificateLifecycle,
  type SalaryCertificateRun,
  type SalaryCertificateSnapshot,
} from "@/lib/accounting/salary-certificates"
import type { Database, SalaryCertificate, SalaryCertificateStatus } from "@/lib/types"
import { generateSalaryCertificatePdf } from "@/lib/utils/pdf/salary-certificate-pdf"

type PayrollRunRow = Database["public"]["Tables"]["payroll_runs"]["Row"]
type PayrollRunItemRow = Database["public"]["Tables"]["payroll_run_items"]["Row"]
type PayrollRunComponentRow = Database["public"]["Tables"]["payroll_run_components"]["Row"]
type VoucherRow = Database["public"]["Tables"]["vouchers"]["Row"]
type PaymentModeRow = Database["public"]["Tables"]["payment_modes"]["Row"]

export type SalaryCertificateListItem = {
  id: string
  certificateNo: string
  issueDate: string
  generatedAt: string | null
  status: SalaryCertificateStatus
  employeeName: string
  fiscalYearLabel: string
}

export function isMissingSalaryCertificateSchemaError(message?: string | null) {
  if (!message) return false
  return message.includes("salary_certificates") || message.includes("schema cache")
}

function asSnapshot(value: unknown) {
  return value as SalaryCertificateSnapshot
}

function formatDateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null
}

async function loadPayrollRuns(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId: string
) {
  const { data: runs, error: runsError } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .neq("status", "cancelled")
    .order("period_start", { ascending: true })

  if (runsError) {
    throw new Error(runsError.message || "Unable to load payroll runs.")
  }

  const runRows = (runs ?? []) as PayrollRunRow[]
  const runIds = runRows.map((run) => run.id)

  const { data: items, error: itemsError } = runIds.length
    ? await supabase.from("payroll_run_items").select("*").in("payroll_run_id", runIds)
    : { data: [] as PayrollRunItemRow[], error: null }

  if (itemsError) {
    throw new Error(itemsError.message || "Unable to load payroll run items.")
  }

  const itemRows = (items ?? []) as PayrollRunItemRow[]
  const itemIds = itemRows.map((item) => item.id)
  const voucherIds = runRows
    .map((run) => run.payment_voucher_id)
    .filter((value): value is string => Boolean(value))

  const [{ data: components, error: componentsError }, { data: vouchers, error: vouchersError }] = await Promise.all([
    itemIds.length
      ? supabase.from("payroll_run_components").select("*").in("run_item_id", itemIds)
      : Promise.resolve({ data: [] as PayrollRunComponentRow[], error: null }),
    voucherIds.length
      ? supabase.from("vouchers").select("*").in("id", voucherIds)
      : Promise.resolve({ data: [] as VoucherRow[], error: null }),
  ])

  if (componentsError) {
    throw new Error(componentsError.message || "Unable to load payroll components.")
  }

  if (vouchersError) {
    throw new Error(vouchersError.message || "Unable to load payroll vouchers.")
  }

  const voucherRows = (vouchers ?? []) as VoucherRow[]
  const paymentModeIds = voucherRows
    .map((voucher) => voucher.payment_mode_id)
    .filter((value): value is string => Boolean(value))

  const { data: paymentModes, error: paymentModesError } = paymentModeIds.length
    ? await supabase.from("payment_modes").select("*").in("id", paymentModeIds)
    : { data: [] as PaymentModeRow[], error: null }

  if (paymentModesError) {
    throw new Error(paymentModesError.message || "Unable to load payment mode details.")
  }

  const itemsByRun = new Map<string, PayrollRunItemRow[]>()
  const componentsByItem = new Map<string, PayrollRunComponentRow[]>()
  const vouchersById = new Map(voucherRows.map((voucher) => [voucher.id, voucher]))
  const paymentModesById = new Map(((paymentModes ?? []) as PaymentModeRow[]).map((mode) => [mode.id, mode]))

  itemRows.forEach((item) => {
    const current = itemsByRun.get(item.payroll_run_id) ?? []
    current.push(item)
    itemsByRun.set(item.payroll_run_id, current)
  })

  ;((components ?? []) as PayrollRunComponentRow[]).forEach((component) => {
    const current = componentsByItem.get(component.run_item_id) ?? []
    current.push(component)
    componentsByItem.set(component.run_item_id, current)
  })

  const payrollRuns: SalaryCertificateRun[] = runRows.map((run) => {
    const paymentVoucher = run.payment_voucher_id ? vouchersById.get(run.payment_voucher_id) ?? null : null
    const paymentMode = paymentVoucher?.payment_mode_id
      ? paymentModesById.get(paymentVoucher.payment_mode_id) ?? null
      : null

    return {
      id: run.id,
      periodLabel: run.period_label,
      periodStart: formatDateOnly(run.period_start) ?? run.period_start,
      periodEnd: formatDateOnly(run.period_end) ?? run.period_end,
      paymentVoucherNo: paymentVoucher?.voucher_no ?? null,
      paymentVoucherDate: formatDateOnly(paymentVoucher?.voucher_date),
      paymentModeName: paymentMode?.name ?? null,
      items: (itemsByRun.get(run.id) ?? []).map((item) => ({
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        designation: item.designation,
        components: (componentsByItem.get(item.id) ?? []).map((component) => ({
          code: component.code,
          amount: component.amount,
        })),
      })),
    }
  })

  return payrollRuns
}

async function getNextSequence(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId: string,
  fiscalYearLabel: string
) {
  const { data, error } = await supabase
    .from("salary_certificates")
    .select("certificate_no")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)

  if (error) {
    if (isMissingSalaryCertificateSchemaError(error.message)) {
      throw new Error("Salary certificate setup is not complete yet. Please apply the latest database migration.")
    }
    throw new Error(error.message || "Unable to resolve salary certificate sequence.")
  }

  const prefix = `SAL/${fiscalYearLabel}/`
  const sequences = (data ?? [])
    .map((row) => String(row.certificate_no ?? ""))
    .filter((value) => value.startsWith(prefix))
    .map((value) => Number(value.slice(prefix.length)))
    .filter((value) => Number.isFinite(value))

  return (sequences.length ? Math.max(...sequences) : 0) + 1
}

export async function listSalaryCertificates(
  supabase: SupabaseClient<Database>,
  clientId: string,
  fiscalYearId?: string,
  employeeId?: string
) {
  let query = supabase
    .from("salary_certificates")
    .select("*")
    .eq("client_id", clientId)
    .order("generated_at", { ascending: false })

  if (fiscalYearId) {
    query = query.eq("fiscal_year_id", fiscalYearId)
  }

  if (employeeId) {
    query = query.eq("employee_id", employeeId)
  }

  const { data, error } = await query

  if (error) {
    if (isMissingSalaryCertificateSchemaError(error.message)) {
      return []
    }
    throw new Error(error.message || "Unable to load salary certificate history.")
  }

  return ((data ?? []) as SalaryCertificate[]).map((row) => {
    const snapshot = asSnapshot(row.snapshot_json)
    return {
      id: row.id,
      certificateNo: row.certificate_no,
      issueDate: row.issue_date,
      generatedAt: row.generated_at,
      status: row.status as SalaryCertificateStatus,
      employeeName: snapshot.employee.name,
      fiscalYearLabel: snapshot.fiscalYear.label,
    } satisfies SalaryCertificateListItem
  })
}

export async function buildSalaryCertificatePreview(
  supabase: SupabaseClient<Database>,
  input: {
    clientId: string
    employeeId: string
    fiscalYearId: string
  }
) {
  const [{ data: client, error: clientError }, { data: fiscalYear, error: fiscalYearError }, { data: employee, error: employeeError }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", input.clientId).maybeSingle(),
      supabase.from("fiscal_years").select("*").eq("id", input.fiscalYearId).eq("client_id", input.clientId).maybeSingle(),
      supabase.from("payroll_employees").select("*").eq("id", input.employeeId).eq("client_id", input.clientId).maybeSingle(),
    ])

  if (clientError || !client) {
    throw new Error(clientError?.message || "Client not found.")
  }

  if (fiscalYearError || !fiscalYear) {
    throw new Error(fiscalYearError?.message || "Fiscal year not found.")
  }

  if (employeeError || !employee) {
    throw new Error(employeeError?.message || "Employee not found.")
  }

  const payrollRuns = await loadPayrollRuns(supabase, client.id, fiscalYear.id)
  const aggregation = aggregateAnnualPayroll({
    employeeId: employee.id,
    employeeCode: employee.employee_code,
    employeeName: employee.name,
    designation: employee.designation,
    joiningDate: employee.joining_date,
    fiscalYearLabel: fiscalYear.label,
    fiscalYearStart: formatDateOnly(fiscalYear.start_date) ?? fiscalYear.start_date,
    fiscalYearEnd: formatDateOnly(fiscalYear.end_date) ?? fiscalYear.end_date,
    runs: payrollRuns,
  })

  if (!aggregation.ok) {
    return aggregation
  }

  const sequence = await getNextSequence(supabase, client.id, fiscalYear.id, fiscalYear.label)
  const issueDate = format(new Date(), "yyyy-MM-dd")

  const snapshot: SalaryCertificateSnapshot = {
    certificateNo: buildSalaryCertificateNumber({
      fiscalYearLabel: fiscalYear.label,
      sequence,
    }),
    issueDate,
    generatedAt: new Date().toISOString(),
    client: {
      id: client.id,
      name: client.name,
      tradeName: client.trade_name,
      address: client.address,
      phone: client.phone,
      email: client.email,
      tin: client.tin,
      bin: client.bin,
    },
    fiscalYear: {
      id: fiscalYear.id,
      label: fiscalYear.label,
      startDate: formatDateOnly(fiscalYear.start_date) ?? fiscalYear.start_date,
      endDate: formatDateOnly(fiscalYear.end_date) ?? fiscalYear.end_date,
      assessmentYearLabel: buildAssessmentYearLabel(fiscalYear.label),
    },
    employee: {
      id: employee.id,
      employeeCode: employee.employee_code,
      name: aggregation.snapshotPayload.employeeName,
      designation: aggregation.snapshotPayload.designation,
      joiningDate: employee.joining_date,
    },
    salary: aggregation.snapshotPayload.salary,
    tax: aggregation.snapshotPayload.tax,
    payrollCoverage: aggregation.snapshotPayload.payrollCoverage,
  }

  return {
    ok: true as const,
    snapshot,
    fiscalYear,
  }
}

export async function generateSalaryCertificateDraft(
  supabase: SupabaseClient<Database>,
  input: {
    clientId: string
    employeeId: string
    fiscalYearId: string
    generatedBy: string | null
  }
) {
  const preview = await buildSalaryCertificatePreview(supabase, input)
  if (!preview.ok) {
    return preview
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("salary_certificates")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("employee_id", input.employeeId)
    .eq("fiscal_year_id", input.fiscalYearId)
    .order("generated_at", { ascending: false })

  if (existingError) {
    if (isMissingSalaryCertificateSchemaError(existingError.message)) {
      throw new Error("Salary certificate setup is not complete yet. Please apply the latest database migration.")
    }
    throw new Error(existingError.message || "Unable to inspect existing certificates.")
  }

  const existingCertificates = (existingRows ?? []) as SalaryCertificate[]
  const issuedCertificate = existingCertificates.find((row) => row.status === "issued")
  if (issuedCertificate) {
    return {
      ok: false as const,
      error: "Issued certificates are immutable.",
    }
  }

  const draftCertificate = existingCertificates.find((row) => row.status === "draft")
  if (draftCertificate) {
    const lifecycle = validateSalaryCertificateLifecycle({
      operation: "generate",
      status: draftCertificate.status as SalaryCertificateStatus,
      isFiscalYearClosed: preview.fiscalYear.is_closed,
    })
    if (!lifecycle.ok) {
      return lifecycle
    }

    const snapshot = {
      ...preview.snapshot,
      certificateNo: asSnapshot(draftCertificate.snapshot_json).certificateNo || draftCertificate.certificate_no,
    }

    const { data: updated, error: updateError } = await supabase
      .from("salary_certificates")
      .update({
        issue_date: snapshot.issueDate,
        generated_by: input.generatedBy,
        generated_at: new Date().toISOString(),
        snapshot_json: snapshot,
      })
      .eq("id", draftCertificate.id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Unable to regenerate draft certificate.")
    }

    return {
      ok: true as const,
      certificate: updated as SalaryCertificate,
      snapshot,
    }
  }

  const lifecycle = validateSalaryCertificateLifecycle({
    operation: "generate",
    status: null,
    isFiscalYearClosed: preview.fiscalYear.is_closed,
  })
  if (!lifecycle.ok) {
    return lifecycle
  }

  const { data: inserted, error: insertError } = await supabase
    .from("salary_certificates")
    .insert({
      client_id: input.clientId,
      employee_id: input.employeeId,
      fiscal_year_id: input.fiscalYearId,
      certificate_no: preview.snapshot.certificateNo,
      issue_date: preview.snapshot.issueDate,
      generated_by: input.generatedBy,
      status: "draft",
      snapshot_json: preview.snapshot,
    })
    .select("*")
    .single()

  if (insertError || !inserted) {
    if (isMissingSalaryCertificateSchemaError(insertError?.message)) {
      throw new Error("Salary certificate setup is not complete yet. Please apply the latest database migration.")
    }
    throw new Error(insertError?.message || "Unable to generate salary certificate.")
  }

  return {
    ok: true as const,
    certificate: inserted as SalaryCertificate,
    snapshot: preview.snapshot,
  }
}

export async function issueSalaryCertificate(
  supabase: SupabaseClient<Database>,
  input: {
    clientId: string
    certificateId: string
  }
) {
  const { data: certificate, error } = await supabase
    .from("salary_certificates")
    .select("*")
    .eq("id", input.certificateId)
    .eq("client_id", input.clientId)
    .maybeSingle()

  if (error || !certificate) {
    if (isMissingSalaryCertificateSchemaError(error?.message)) {
      throw new Error("Salary certificate setup is not complete yet. Please apply the latest database migration.")
    }
    throw new Error(error?.message || "Salary certificate not found.")
  }

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", certificate.fiscal_year_id)
    .eq("client_id", input.clientId)
    .maybeSingle()

  const lifecycle = validateSalaryCertificateLifecycle({
    operation: "issue",
    status: certificate.status as SalaryCertificateStatus,
    isFiscalYearClosed: fiscalYear?.is_closed,
  })

  if (!lifecycle.ok) {
    return lifecycle
  }

  const { data: updated, error: updateError } = await supabase
    .from("salary_certificates")
    .update({ status: "issued" })
    .eq("id", certificate.id)
    .select("*")
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message || "Unable to issue salary certificate.")
  }

  return {
    ok: true as const,
    certificate: updated as SalaryCertificate,
  }
}

export async function getSalaryCertificatePdf(
  supabase: SupabaseClient<Database>,
  input: {
    clientId: string
    certificateId: string
  }
) {
  const { data: certificate, error } = await supabase
    .from("salary_certificates")
    .select("*")
    .eq("id", input.certificateId)
    .eq("client_id", input.clientId)
    .maybeSingle()

  if (error || !certificate) {
    if (isMissingSalaryCertificateSchemaError(error?.message)) {
      throw new Error("Salary certificate setup is not complete yet. Please apply the latest database migration.")
    }
    throw new Error(error?.message || "Salary certificate not found.")
  }

  const snapshot = asSnapshot(certificate.snapshot_json)
  return {
    certificate: certificate as SalaryCertificate,
    snapshot,
    pdf: generateSalaryCertificatePdf(snapshot),
  }
}
