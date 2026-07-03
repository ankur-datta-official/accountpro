"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  PAYROLL_ACCOUNT_DEFAULTS,
  PAYROLL_COMPONENTS,
  calculatePayrollRowSummary,
  getMonthPeriod,
  normalizePayrollRows,
  type PayrollComponentCode,
  type PayrollDraftRow,
} from "@/lib/accounting/payroll"
import { createVoucherAction } from "@/lib/actions/vouchers"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { AccountGroupType, Database, PaymentModeType } from "@/lib/types"

type ServerSupabase = ReturnType<typeof createClient>

const moneySchema = z.coerce.number().min(0).default(0)

const employeeSchema = z.object({
  clientId: z.string().min(1),
  employeeId: z.string().optional(),
  employeeCode: z.string().trim().optional(),
  name: z.string().trim().min(1),
  designation: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  tin: z.string().trim().optional(),
  joiningDate: z.string().optional(),
  leavingDate: z.string().optional(),
  isActive: z.boolean().default(true),
  salary: z
    .object({
      basic: moneySchema,
      housing: moneySchema,
      medical: moneySchema,
      conveyance: moneySchema,
      employerPf: moneySchema,
      staffPf: moneySchema,
      tax: moneySchema,
    })
    .optional(),
})

const componentSchema = z.object({
  code: z.enum(Object.keys(PAYROLL_COMPONENTS) as [PayrollComponentCode, ...PayrollComponentCode[]]),
  amount: moneySchema,
})

const payrollRowSchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().trim().min(1),
  designation: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  components: z.array(componentSchema).min(1),
})

const createPayrollRunSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  source: z.enum(["manual", "import"]).default("manual"),
  notes: z.string().trim().optional(),
  rows: z.array(payrollRowSchema).min(1),
  createMissingEmployees: z.boolean().default(false),
})

const deletePayrollRunSchema = z.object({
  clientId: z.string().min(1),
  payrollRunId: z.string().min(1),
})

const rerunPayrollRunSchema = deletePayrollRunSchema.extend({
  reason: z.string().trim().optional(),
})

const postAccrualSchema = deletePayrollRunSchema.extend({
  voucherDate: z.string().min(1),
})

const postPaymentSchema = postAccrualSchema.extend({
  paymentModeId: z.string().optional(),
  paymentModeName: z.string().optional(),
  paymentModeType: z.enum(["bank", "cash", "mobile_banking", "other"]).optional(),
})

const savePayrollRunItemsSchema = z.object({
  clientId: z.string().min(1),
  payrollRunId: z.string().min(1),
  items: z.array(z.object({
    id: z.string().min(1),
    components: z.array(z.object({
      code: z.string().min(1),
      amount: moneySchema,
    })),
  })),
})

async function getAuthorizedClient(clientId: string) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  if (!membership?.org_id) {
    return { success: false as const, error: "No active organization found." }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("org_id", membership.org_id)
    .maybeSingle()

  if (!client) {
    return { success: false as const, error: "Client not found." }
  }

  return { success: true as const, supabase, client }
}

async function ensureAccountGroup(
  supabase: ServerSupabase,
  clientId: string,
  name: string,
  type: AccountGroupType
) {
  const { data: existing } = await supabase
    .from("account_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", name)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("account_groups")
    .insert({ client_id: clientId, name, type, sort_order: 999 })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? `Unable to create account group ${name}.`)
  return data.id
}

async function ensureSemiSubGroup(
  supabase: ServerSupabase,
  clientId: string,
  groupId: string,
  name: string
) {
  const { data: existing } = await supabase
    .from("account_semi_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("group_id", groupId)
    .eq("name", name)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("account_semi_sub_groups")
    .insert({ client_id: clientId, group_id: groupId, name, sort_order: 999 })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? `Unable to create account group ${name}.`)
  return data.id
}

async function ensureSubGroup(
  supabase: ServerSupabase,
  clientId: string,
  semiSubId: string,
  name: string
) {
  const { data: existing } = await supabase
    .from("account_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("semi_sub_id", semiSubId)
    .eq("name", name)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("account_sub_groups")
    .insert({ client_id: clientId, semi_sub_id: semiSubId, name, sort_order: 999 })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? `Unable to create account group ${name}.`)
  return data.id
}

async function ensureAccountHead(
  supabase: ServerSupabase,
  clientId: string,
  definition: (typeof PAYROLL_ACCOUNT_DEFAULTS)[number]
) {
  const { data: existing } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", definition.headName)
    .maybeSingle()

  if (existing?.id) return existing.id

  const groupId = await ensureAccountGroup(supabase, clientId, definition.groupName, definition.groupType)
  const semiSubId = await ensureSemiSubGroup(supabase, clientId, groupId, definition.semiName)
  const subGroupId = await ensureSubGroup(supabase, clientId, semiSubId, definition.subName)

  const { data, error } = await supabase
    .from("account_heads")
    .insert({
      client_id: clientId,
      sub_group_id: subGroupId,
      name: definition.headName,
      opening_balance: 0,
      balance_type: definition.balanceType,
      is_active: true,
      sort_order: 999,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? `Unable to create account head ${definition.headName}.`)
  return data.id
}

async function ensurePayrollAccountMappings(supabase: ServerSupabase, clientId: string) {
  const mappings = new Map<string, string>()

  for (const definition of PAYROLL_ACCOUNT_DEFAULTS) {
    const headId = await ensureAccountHead(supabase, clientId, definition)
    const { data: existing } = await supabase
      .from("payroll_account_mappings")
      .select("id,account_head_id")
      .eq("client_id", clientId)
      .eq("component_code", definition.mappingCode)
      .maybeSingle()

    if (!existing?.id) {
      await supabase.from("payroll_account_mappings").insert({
        client_id: clientId,
        component_code: definition.mappingCode,
        account_head_id: headId,
      })
      mappings.set(definition.mappingCode, headId)
    } else {
      mappings.set(definition.mappingCode, existing.account_head_id)
    }
  }

  return mappings
}

function revalidatePayrollPaths(clientId: string, payrollRunId?: string) {
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/payroll`)
  if (payrollRunId) revalidatePath(`/clients/${clientId}/payroll/runs/${payrollRunId}`)
}

export async function savePayrollEmployeeAction(input: z.input<typeof employeeSchema>) {
  const parsed = employeeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid employee data." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const values = parsed.data

  const employeePayload: Database["public"]["Tables"]["payroll_employees"]["Insert"] = {
    client_id: client.id,
    employee_code: values.employeeCode || null,
    name: values.name,
    designation: values.designation || null,
    grade: values.grade || null,
    phone: values.phone || null,
    email: values.email || null,
    tin: values.tin || null,
    joining_date: values.joiningDate || null,
    leaving_date: values.leavingDate || null,
    is_active: values.isActive,
    updated_at: new Date().toISOString(),
  }

  const { data: employee, error } = values.employeeId
    ? await supabase
        .from("payroll_employees")
        .update(employeePayload)
        .eq("id", values.employeeId)
        .eq("client_id", client.id)
        .select("*")
        .single()
    : await supabase.from("payroll_employees").insert(employeePayload).select("*").single()

  if (error || !employee) {
    return { success: false as const, error: error?.message ?? "Unable to save employee." }
  }

  if (values.salary) {
    const salaryPayload = {
      client_id: client.id,
      employee_id: employee.id,
      basic: values.salary.basic,
      housing: values.salary.housing,
      medical: values.salary.medical,
      conveyance: values.salary.conveyance,
      employer_pf: values.salary.employerPf,
      staff_pf: values.salary.staffPf,
      tax: values.salary.tax,
      updated_at: new Date().toISOString(),
    }

    const { error: salaryError } = await supabase
      .from("payroll_salary_structures")
      .upsert(salaryPayload, { onConflict: "client_id,employee_id" })

    if (salaryError) {
      return { success: false as const, error: salaryError.message ?? "Unable to save salary structure." }
    }
  }

  revalidatePayrollPaths(client.id)
  return { success: true as const, employeeId: employee.id }
}

export async function ensurePayrollDefaultsAction(input: { clientId: string }) {
  const parsed = z.object({ clientId: z.string().min(1) }).safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: "Invalid client." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  try {
    await ensurePayrollAccountMappings(context.supabase, context.client.id)
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unable to create payroll defaults.",
    }
  }

  revalidatePayrollPaths(context.client.id)
  return { success: true as const }
}

async function findOrCreateEmployee(
  supabase: ServerSupabase,
  clientId: string,
  row: PayrollDraftRow,
  createMissingEmployees: boolean
) {
  if (row.employeeId) {
    return row.employeeId
  }

  const { data: existing } = await supabase
    .from("payroll_employees")
    .select("id")
    .eq("client_id", clientId)
    .ilike("name", row.employeeName)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  if (!createMissingEmployees) {
    return null
  }

  const { data: inserted } = await supabase
    .from("payroll_employees")
    .insert({
      client_id: clientId,
      name: row.employeeName,
      designation: row.designation || null,
      grade: row.grade || null,
      is_active: true,
    })
    .select("id")
    .single()

  return inserted?.id ?? null
}

function dbAmount(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

async function getPayrollRowsFromSalaryStructures(supabase: ServerSupabase, clientId: string) {
  const [employeesResult, salariesResult] = await Promise.all([
    supabase
      .from("payroll_employees")
      .select("*")
      .eq("client_id", clientId)
      .neq("is_active", false)
      .order("name"),
    supabase.from("payroll_salary_structures").select("*").eq("client_id", clientId),
  ])

  if (employeesResult.error) {
    return { success: false as const, error: employeesResult.error.message }
  }

  if (salariesResult.error) {
    return { success: false as const, error: salariesResult.error.message }
  }

  const salariesByEmployee = new Map((salariesResult.data ?? []).map((salary) => [salary.employee_id, salary]))
  const rows = (employeesResult.data ?? []).map((employee) => {
    const salary = salariesByEmployee.get(employee.id)

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      designation: employee.designation ?? undefined,
      grade: employee.grade ?? undefined,
      components: [
        { code: "basic" as const, amount: dbAmount(salary?.basic) },
        { code: "housing" as const, amount: dbAmount(salary?.housing) },
        { code: "medical" as const, amount: dbAmount(salary?.medical) },
        { code: "conveyance" as const, amount: dbAmount(salary?.conveyance) },
        { code: "employer_pf" as const, amount: dbAmount(salary?.employer_pf) },
        { code: "staff_pf" as const, amount: dbAmount(salary?.staff_pf) },
        { code: "tax" as const, amount: dbAmount(salary?.tax) },
      ],
    } satisfies PayrollDraftRow
  })

  return { success: true as const, rows: normalizePayrollRows(rows) }
}

async function recordPayrollAuditTrail(
  supabase: ServerSupabase,
  input: {
    payrollRunId: string
    action: string
    details: string
    userId?: string | null
  }
) {
  const { error } = await supabase.from("payroll_audit_trail").insert({
    payroll_run_id: input.payrollRunId,
    action: input.action,
    details: input.details,
    changed_by: input.userId ?? null,
  })

  if (error && !error.message.toLowerCase().includes("payroll_audit_trail")) {
    return { success: false as const, error: error.message }
  }

  return { success: true as const }
}

export async function createPayrollRunAction(input: z.input<typeof createPayrollRunSchema>) {
  const parsed = createPayrollRunSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll run data." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", parsed.data.fiscalYearId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!fiscalYear) {
    return { success: false as const, error: "Fiscal year not found." }
  }

  if (fiscalYear.is_closed) {
    return { success: false as const, error: "You cannot create payroll in a closed fiscal year." }
  }

  const rows = normalizePayrollRows(parsed.data.rows)
  if (!rows.length) {
    return { success: false as const, error: "Payroll run needs at least one payable row." }
  }

  await ensurePayrollAccountMappings(supabase, client.id)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const period = getMonthPeriod(parsed.data.month)

  const { data: payrollRun, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      client_id: client.id,
      fiscal_year_id: fiscalYear.id,
      period_label: period.periodLabel,
      period_start: period.periodStart,
      period_end: period.periodEnd,
      status: "draft",
      source: parsed.data.source,
      notes: parsed.data.notes || null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (runError || !payrollRun) {
    return { success: false as const, error: runError?.message ?? "Unable to create payroll run." }
  }

  for (const row of rows) {
    const employeeId = await findOrCreateEmployee(
      supabase,
      client.id,
      row,
      parsed.data.createMissingEmployees
    )
    const summary = calculatePayrollRowSummary(row.components)

    const { data: item, error: itemError } = await supabase
      .from("payroll_run_items")
      .insert({
        payroll_run_id: payrollRun.id,
        employee_id: employeeId,
        employee_name: row.employeeName,
        designation: row.designation || null,
        grade: row.grade || null,
        gross_salary: summary.grossSalary,
        total_additions: summary.totalAdditions,
        total_deductions: summary.totalDeductions,
        net_payable: summary.netPayable,
      })
      .select("id")
      .single()

    if (itemError || !item) {
      await supabase.from("payroll_runs").delete().eq("id", payrollRun.id)
      return { success: false as const, error: itemError?.message ?? "Unable to create payroll row." }
    }

    const componentRows = row.components.map((component) => {
      const definition = PAYROLL_COMPONENTS[component.code]
      return {
        run_item_id: item.id,
        code: component.code,
        label: definition.label,
        kind: definition.kind,
        amount: component.amount,
      }
    })

    const { error: componentError } = await supabase
      .from("payroll_run_components")
      .insert(componentRows)

    if (componentError) {
      await supabase.from("payroll_runs").delete().eq("id", payrollRun.id)
      return { success: false as const, error: componentError.message ?? "Unable to create payroll components." }
    }
  }

  await recordPayrollAuditTrail(supabase, {
    payrollRunId: payrollRun.id,
    action: "created",
    details: `Payroll run created from ${parsed.data.source === "import" ? "Excel import" : "saved salary setup"}.`,
    userId: user?.id,
  })

  revalidatePayrollPaths(client.id, payrollRun.id)
  return { success: true as const, payrollRunId: payrollRun.id }
}

export async function deletePayrollRunAction(input: z.input<typeof deletePayrollRunSchema>) {
  const parsed = deletePayrollRunSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll run." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const { data: payrollRun } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", parsed.data.payrollRunId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!payrollRun) return { success: false as const, error: "Payroll run not found." }
  if (payrollRun.status !== "draft" && payrollRun.status !== "reviewed") {
    return { success: false as const, error: "Posted payroll runs cannot be deleted." }
  }

  const { error } = await supabase.from("payroll_runs").delete().eq("id", payrollRun.id)
  if (error) return { success: false as const, error: error.message ?? "Unable to delete payroll run." }

  revalidatePayrollPaths(client.id)
  return { success: true as const }
}

export async function savePayrollRunItemsAction(input: z.input<typeof savePayrollRunItemsSchema>) {
  const parsed = savePayrollRunItemsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll run items." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context

  // Fetch existing run to check status
  const { data: existingRun, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', parsed.data.payrollRunId)
    .eq('client_id', client.id)
    .single()

  if (runError || !existingRun) {
    return { success: false as const, error: "Payroll run not found." }
  }

  if (existingRun.accrual_voucher_id || existingRun.payment_voucher_id) {
    return { success: false as const, error: "Cannot edit posted payroll runs." }
  }

  // Update each item and its components
  for (const item of parsed.data.items) {
    // Recalculate summary
    const summary = calculatePayrollRowSummary(item.components)

    // Update item
    const { error: itemError } = await supabase
      .from('payroll_run_items')
      .update({
        gross_salary: summary.grossSalary,
        total_additions: summary.totalAdditions,
        total_deductions: summary.totalDeductions,
        net_payable: summary.netPayable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('payroll_run_id', parsed.data.payrollRunId)

    if (itemError) {
      return { success: false as const, error: itemError.message ?? "Unable to update payroll item." }
    }

    // Delete existing components
    const { error: deleteError } = await supabase
      .from('payroll_run_components')
      .delete()
      .eq('run_item_id', item.id)

    if (deleteError) {
      return { success: false as const, error: deleteError.message ?? "Unable to delete old components." }
    }

    // Insert new components
    const componentsToInsert = item.components
      .filter(c => c.amount > 0)
      .map(c => {
        const definition = PAYROLL_COMPONENTS[c.code as PayrollComponentCode]
        return {
          run_item_id: item.id,
          code: c.code,
          label: definition?.label ?? c.code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          kind: definition?.kind ?? 'earning',
          amount: c.amount,
        }
      })

    if (componentsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('payroll_run_components')
        .insert(componentsToInsert)

      if (insertError) {
        return { success: false as const, error: insertError.message ?? "Unable to save components." }
      }
    }
  }

  revalidatePayrollPaths(client.id, parsed.data.payrollRunId)
  return { success: true as const }
}

export async function rerunPayrollRunAction(input: z.input<typeof rerunPayrollRunSchema>) {
  const parsed = rerunPayrollRunSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll run." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const { data: payrollRun } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", parsed.data.payrollRunId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!payrollRun) return { success: false as const, error: "Payroll run not found." }
  if (payrollRun.accrual_voucher_id || payrollRun.payment_voucher_id || payrollRun.status === "posted" || payrollRun.status === "paid") {
    return { success: false as const, error: "Posted or paid payroll runs are locked. Create an adjustment run instead." }
  }

  const rowsResult = await getPayrollRowsFromSalaryStructures(supabase, client.id)
  if (!rowsResult.success) return rowsResult
  if (!rowsResult.rows.length) {
    return { success: false as const, error: "No active employees with salary amounts were found." }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existingItems } = await supabase
    .from("payroll_run_items")
    .select("id")
    .eq("payroll_run_id", payrollRun.id)

  const existingItemIds = (existingItems ?? []).map((item) => item.id)
  if (existingItemIds.length) {
    const { error: componentDeleteError } = await supabase
      .from("payroll_run_components")
      .delete()
      .in("run_item_id", existingItemIds)

    if (componentDeleteError) {
      return { success: false as const, error: componentDeleteError.message ?? "Unable to clear payroll components." }
    }
  }

  const { error: itemDeleteError } = await supabase
    .from("payroll_run_items")
    .delete()
    .eq("payroll_run_id", payrollRun.id)

  if (itemDeleteError) {
    return { success: false as const, error: itemDeleteError.message ?? "Unable to clear payroll rows." }
  }

  for (const row of rowsResult.rows) {
    const summary = calculatePayrollRowSummary(row.components)
    const { data: item, error: itemError } = await supabase
      .from("payroll_run_items")
      .insert({
        payroll_run_id: payrollRun.id,
        employee_id: row.employeeId ?? null,
        employee_name: row.employeeName,
        designation: row.designation || null,
        grade: row.grade || null,
        gross_salary: summary.grossSalary,
        total_additions: summary.totalAdditions,
        total_deductions: summary.totalDeductions,
        net_payable: summary.netPayable,
      })
      .select("id")
      .single()

    if (itemError || !item) {
      return { success: false as const, error: itemError?.message ?? "Unable to recreate payroll rows." }
    }

    const componentRows = row.components.map((component) => {
      const definition = PAYROLL_COMPONENTS[component.code]
      return {
        run_item_id: item.id,
        code: component.code,
        label: definition.label,
        kind: definition.kind,
        amount: component.amount,
      }
    })

    const { error: componentError } = await supabase.from("payroll_run_components").insert(componentRows)
    if (componentError) {
      return { success: false as const, error: componentError.message ?? "Unable to recreate payroll components." }
    }
  }

  const { error: runUpdateError } = await supabase
    .from("payroll_runs")
    .update({
      status: "draft",
      notes: parsed.data.reason || payrollRun.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRun.id)

  if (runUpdateError) {
    return { success: false as const, error: runUpdateError.message ?? "Unable to update payroll run." }
  }

  await recordPayrollAuditTrail(supabase, {
    payrollRunId: payrollRun.id,
    action: "rerun",
    details: parsed.data.reason || "Payroll re-run from current employee salary setup.",
    userId: user?.id,
  })

  revalidatePayrollPaths(client.id, payrollRun.id)
  return { success: true as const }
}

async function getPayrollRunForPosting(supabase: ServerSupabase, clientId: string, payrollRunId: string) {
  const { data: payrollRun } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", payrollRunId)
    .eq("client_id", clientId)
    .maybeSingle()

  if (!payrollRun) return { success: false as const, error: "Payroll run not found." }

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", payrollRun.fiscal_year_id)
    .eq("client_id", clientId)
    .maybeSingle()

  if (!fiscalYear || fiscalYear.is_closed) {
    return { success: false as const, error: "The payroll fiscal year is closed or unavailable." }
  }

  const { data: items } = await supabase
    .from("payroll_run_items")
    .select("*")
    .eq("payroll_run_id", payrollRun.id)

  if (!items?.length) {
    return { success: false as const, error: "Payroll run has no employee rows." }
  }

  const { data: components } = await supabase
    .from("payroll_run_components")
    .select("*")
    .in("run_item_id", items.map((item) => item.id))

  return { success: true as const, payrollRun, fiscalYear, items, components: components ?? [] }
}

function addLineAmount(lines: Map<string, number>, key: string, amount: number) {
  lines.set(key, Number(((lines.get(key) ?? 0) + amount).toFixed(2)))
}

function getAccountsGroupForMapping(mappingCode: string): AccountGroupType {
  if (mappingCode.includes("expense")) return "expense"
  if (mappingCode.includes("income")) return "income"
  if (mappingCode.includes("advance")) return "asset"
  return "liability"
}

export async function postPayrollAccrualAction(input: z.input<typeof postAccrualSchema>) {
  const parsed = postAccrualSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll posting data." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const runResult = await getPayrollRunForPosting(supabase, client.id, parsed.data.payrollRunId)
  if (!runResult.success) return runResult

  const { payrollRun, fiscalYear, items, components } = runResult
  if (payrollRun.accrual_voucher_id) {
    return { success: false as const, error: "Payroll accrual has already been posted." }
  }

  const mappings = await ensurePayrollAccountMappings(supabase, client.id)
  const debitByMapping = new Map<string, number>()
  const creditByMapping = new Map<string, number>()
  const netPayable = items.reduce((sum, item) => sum + Number(item.net_payable ?? 0), 0)

  for (const component of components) {
    const definition = PAYROLL_COMPONENTS[component.code as PayrollComponentCode]
    if (!definition) continue

    const value = Number(component.amount ?? 0)
    if (value <= 0) continue

    if (definition.kind === "deduction") {
      addLineAmount(creditByMapping, definition.mappingCode, value)
    } else {
      addLineAmount(debitByMapping, definition.mappingCode, value)
    }
  }

  addLineAmount(creditByMapping, "salary_payable", netPayable)

  const lines = [
    ...Array.from(debitByMapping.entries()).map(([mappingCode, value]) => ({
      accountsGroup: getAccountsGroupForMapping(mappingCode),
      accountHeadId: mappings.get(mappingCode) ?? "",
      debitAmount: value,
      creditAmount: 0,
      description: `Payroll ${mappingCode.replace(/_/g, " ")} for ${payrollRun.period_label}`,
    })),
    ...Array.from(creditByMapping.entries()).map(([mappingCode, value]) => ({
      accountsGroup: getAccountsGroupForMapping(mappingCode),
      accountHeadId: mappings.get(mappingCode) ?? "",
      debitAmount: 0,
      creditAmount: value,
      description: `Payroll ${mappingCode.replace(/_/g, " ")} for ${payrollRun.period_label}`,
    })),
  ].filter((line) => line.accountHeadId && (line.debitAmount > 0 || line.creditAmount > 0))

  const result = await createVoucherAction({
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
    voucherDate: parsed.data.voucherDate,
    voucherType: "journal",
    description: `Payroll accrual for ${payrollRun.period_label}`,
    showDescription: true,
    showSupportingDocuments: false,
    lines,
  })

  if (!result.success) return result

  const { error } = await supabase
    .from("payroll_runs")
    .update({
      status: "posted",
      accrual_voucher_id: result.voucherId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRun.id)

  if (error) return { success: false as const, error: error.message ?? "Unable to link payroll voucher." }

  await recordPayrollAuditTrail(supabase, {
    payrollRunId: payrollRun.id,
    action: "posted",
    details: `Posted to accounts as voucher #${result.voucherNo}.`,
  })

  revalidatePayrollPaths(client.id, payrollRun.id)
  return { success: true as const, voucherId: result.voucherId, voucherNo: result.voucherNo }
}

export async function postPayrollPaymentAction(input: z.input<typeof postPaymentSchema>) {
  const parsed = postPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid payroll payment data." }
  }

  const context = await getAuthorizedClient(parsed.data.clientId)
  if (!context.success) return context

  const { supabase, client } = context
  const runResult = await getPayrollRunForPosting(supabase, client.id, parsed.data.payrollRunId)
  if (!runResult.success) return runResult

  const { payrollRun, fiscalYear, items } = runResult
  if (!payrollRun.accrual_voucher_id) {
    return { success: false as const, error: "Post payroll accrual before salary payment." }
  }

  if (payrollRun.payment_voucher_id) {
    return { success: false as const, error: "Payroll salary payment has already been posted." }
  }

  const mappings = await ensurePayrollAccountMappings(supabase, client.id)
  const salaryPayableHead = mappings.get("salary_payable")
  const netPayable = Number(items.reduce((sum, item) => sum + Number(item.net_payable ?? 0), 0).toFixed(2))

  if (!salaryPayableHead || netPayable <= 0) {
    return { success: false as const, error: "No payable salary amount found for this payroll run." }
  }

  const result = await createVoucherAction({
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
    voucherDate: parsed.data.voucherDate,
    voucherType: "payment",
    paymentModeId: parsed.data.paymentModeId,
    paymentModeName: parsed.data.paymentModeName,
    paymentModeType: parsed.data.paymentModeType as PaymentModeType | undefined,
    description: `Payroll salary payment for ${payrollRun.period_label}`,
    showDescription: true,
    showSupportingDocuments: false,
    lines: [
      {
        accountsGroup: "liability",
        accountHeadId: salaryPayableHead,
        debitAmount: netPayable,
        creditAmount: 0,
        description: `Salary payable settled for ${payrollRun.period_label}`,
      },
    ],
  })

  if (!result.success) return result

  const { error } = await supabase
    .from("payroll_runs")
    .update({
      status: "paid",
      payment_voucher_id: result.voucherId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRun.id)

  if (error) return { success: false as const, error: error.message ?? "Unable to link payroll payment voucher." }

  await recordPayrollAuditTrail(supabase, {
    payrollRunId: payrollRun.id,
    action: "paid",
    details: `Payment recorded as voucher #${result.voucherNo}.`,
  })

  revalidatePayrollPaths(client.id, payrollRun.id)
  return { success: true as const, voucherId: result.voucherId, voucherNo: result.voucherNo }
}

export async function savePayrollPolicyAction(input: {
  clientId: string
  housingPercent: number
  medicalPercent: number
  conveyancePercent: number
  employerPfPercent: number
  staffPfPercent: number
  taxPercent: number
}) {
  const supabase = createClient()
  const context = await getAuthorizedClient(input.clientId)
  if (!context.success) return context

  const { supabase: sb, client } = context

  const { data: existing } = await sb
    .from('payroll_policies')
    .select('id')
    .eq('client_id', client.id)
    .maybeSingle()

  if (existing) {
    const { error } = await sb
      .from('payroll_policies')
      .update({
        housing_percent: input.housingPercent,
        medical_percent: input.medicalPercent,
        conveyance_percent: input.conveyancePercent,
        employer_pf_percent: input.employerPfPercent,
        staff_pf_percent: input.staffPfPercent,
        tax_percent: input.taxPercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      return { success: false as const, error: error.message }
    }
  } else {
    const { error } = await sb
      .from('payroll_policies')
      .insert({
        client_id: client.id,
        housing_percent: input.housingPercent,
        medical_percent: input.medicalPercent,
        conveyance_percent: input.conveyancePercent,
        employer_pf_percent: input.employerPfPercent,
        staff_pf_percent: input.staffPfPercent,
        tax_percent: input.taxPercent,
      })

    if (error) {
      return { success: false as const, error: error.message }
    }
  }

  revalidatePayrollPaths(client.id)
  return { success: true as const }
}

export async function savePayrollAccountMappingsAction(input: {
  clientId: string
  mappings: Array<{ componentCode: string; accountHeadId: string }>
}) {
  const supabase = createClient()
  const context = await getAuthorizedClient(input.clientId)
  if (!context.success) return context

  const { supabase: sb, client } = context

  for (const mapping of input.mappings) {
    const { data: existing } = await sb
      .from('payroll_account_mappings')
      .select('id')
      .eq('client_id', client.id)
      .eq('component_code', mapping.componentCode)
      .maybeSingle()

    if (existing) {
      const { error } = await sb
        .from('payroll_account_mappings')
        .update({
          account_head_id: mapping.accountHeadId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        return { success: false as const, error: error.message }
      }
    } else {
      const { error } = await sb
        .from('payroll_account_mappings')
        .insert({
          client_id: client.id,
          component_code: mapping.componentCode,
          account_head_id: mapping.accountHeadId,
        })

      if (error) {
        return { success: false as const, error: error.message }
      }
    }
  }

  revalidatePayrollPaths(client.id)
  return { success: true as const }
}
