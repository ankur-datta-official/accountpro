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
import { resolvePaymentModeAccountHead } from "@/lib/accounting/payment-modes"
import {
  buildPayrollAccrualVoucherLines,
  buildPayrollPaymentVoucherLines,
  runPayrollCompensatingAction,
  validatePaymentAccountHead,
  validateDuplicatePayrollRun,
  validatePayrollLifecycle,
  validatePayrollPeriodWithinFiscalYear,
  validateResolvedPayrollEmployees,
} from "@/lib/accounting/payroll-integrity"
import { createVoucherAction } from "@/lib/actions/vouchers"
import { extractClientIdFromRouteSegment, isUuid, matchesClientRouteSegment } from "@/lib/routing/clients"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { AccountGroupType, Database, PaymentModeType, PayrollRunItemUpdate } from "@/lib/types"

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type ClientRow = Database["public"]["Tables"]["clients"]["Row"]
type PayrollRunItemRow = Database["public"]["Tables"]["payroll_run_items"]["Row"]
type PayrollRunComponentRow = Database["public"]["Tables"]["payroll_run_components"]["Row"]

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
    components: z.array(componentSchema),
  })),
})

async function getAuthorizedClient(clientId: string) {
  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()
  const normalizedClientId = extractClientIdFromRouteSegment(clientId)

  if (!membership?.org_id) {
    return { success: false as const, error: "No active organization found." }
  }

  const client = isUuid(normalizedClientId)
    ? (
        await supabase
          .from("clients")
          .select("*")
          .eq("id", normalizedClientId)
          .eq("org_id", membership.org_id)
          .maybeSingle()
      ).data ?? null
    : (
        await supabase.from("clients").select("*").eq("org_id", membership.org_id)
      ).data?.find((candidate: ClientRow) => matchesClientRouteSegment(candidate, clientId)) ?? null

  if (!client) {
    return { success: false as const, error: "Client not found." }
  }

  return { success: true as const, supabase, client }
}

async function ensureAccountHeadNode(
  supabase: ServerSupabase,
  clientId: string,
  name: string,
  parentId: string | null,
  type?: AccountGroupType
) {
  let query = supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", name);

  if (parentId === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parentId);
  }

  const { data: existing } = await query.maybeSingle()

  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from("account_heads")
    .insert({
      client_id: clientId,
      parent_id: parentId,
      name,
      type: parentId ? null : type, // Only root nodes have type
      opening_balance: 0,
      balance_type: "debit",
      is_active: true,
      sort_order: 999,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? `Unable to create account head ${name}.`)
  return data.id
}

async function _ensureAccountHead(
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

  // Create hierarchy: groupName (root) → semiName → subName → headName
  const groupId = await ensureAccountHeadNode(supabase, clientId, definition.groupName, null, definition.groupType)
  const semiSubId = await ensureAccountHeadNode(supabase, clientId, definition.semiName, groupId)
  const subGroupId = await ensureAccountHeadNode(supabase, clientId, definition.subName, semiSubId)
  const headId = await ensureAccountHeadNode(supabase, clientId, definition.headName, subGroupId)

  // Update the final head with correct balance type
  await supabase
    .from("account_heads")
    .update({ balance_type: definition.balanceType })
    .eq("id", headId)

  return headId
}

async function ensureStructuredPayrollAccountHead(
  supabase: ServerSupabase,
  clientId: string,
  definition: (typeof PAYROLL_ACCOUNT_DEFAULTS)[number]
) {
  const { data: existingGroup } = await supabase
    .from("account_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", definition.groupName)
    .maybeSingle()

  let groupId = existingGroup?.id ?? null
  if (!groupId) {
    const { data, error } = await supabase
      .from("account_groups")
      .insert({
        client_id: clientId,
        name: definition.groupName,
        type: definition.groupType,
        sort_order: 999,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? `Unable to create account group ${definition.groupName}.`)
    }

    groupId = data.id
  }

  const { data: existingSemi } = await supabase
    .from("account_semi_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("group_id", groupId)
    .eq("name", definition.semiName)
    .maybeSingle()

  let semiSubId = existingSemi?.id ?? null
  if (!semiSubId) {
    const { data, error } = await supabase
      .from("account_semi_sub_groups")
      .insert({
        client_id: clientId,
        group_id: groupId,
        name: definition.semiName,
        sort_order: 999,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? `Unable to create semi-sub group ${definition.semiName}.`)
    }

    semiSubId = data.id
  }

  const { data: existingSub } = await supabase
    .from("account_sub_groups")
    .select("id")
    .eq("client_id", clientId)
    .eq("semi_sub_id", semiSubId)
    .eq("name", definition.subName)
    .maybeSingle()

  let subGroupId = existingSub?.id ?? null
  if (!subGroupId) {
    const { data, error } = await supabase
      .from("account_sub_groups")
      .insert({
        client_id: clientId,
        semi_sub_id: semiSubId,
        name: definition.subName,
        sort_order: 999,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? `Unable to create sub-group ${definition.subName}.`)
    }

    subGroupId = data.id
  }

  const { data: existingHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("sub_group_id", subGroupId)
    .eq("name", definition.headName)
    .maybeSingle()

  if (existingHead?.id) {
    await supabase
      .from("account_heads")
      .update({ balance_type: definition.balanceType, type: definition.groupType })
      .eq("id", existingHead.id)
    return existingHead.id
  }

  const { data, error } = await supabase
    .from("account_heads")
    .insert({
      client_id: clientId,
      sub_group_id: subGroupId,
      parent_id: null,
      name: definition.headName,
      type: definition.groupType,
      opening_balance: 0,
      balance_type: definition.balanceType,
      is_active: true,
      sort_order: 999,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to create account head ${definition.headName}.`)
  }

  return data.id
}

async function ensurePayrollAccountMappings(supabase: ServerSupabase, clientId: string) {
  const mappings = new Map<string, string>()

  for (const definition of PAYROLL_ACCOUNT_DEFAULTS) {
    const headId = await ensureStructuredPayrollAccountHead(supabase, clientId, definition)
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
    const { data: employee } = await supabase
      .from("payroll_employees")
      .select("id, client_id, is_active")
      .eq("id", row.employeeId)
      .eq("client_id", clientId)
      .maybeSingle()

    const validation = validateResolvedPayrollEmployees({
      expectedClientId: clientId,
      employees: employee
        ? [{ id: employee.id, clientId: employee.client_id, isActive: employee.is_active }]
        : [],
    })

    if (!employee || !validation.ok) {
      return { success: false as const, error: validation.ok ? "Payroll rows must reference active employees from the same client." : validation.error }
    }

    return { success: true as const, employeeId: employee.id, createdEmployeeId: null }
  }

  const { data: existing } = await supabase
    .from("payroll_employees")
    .select("id, client_id, is_active")
    .eq("client_id", clientId)
    .ilike("name", row.employeeName)
    .neq("is_active", false)
    .maybeSingle()

  if (existing?.id) {
    return { success: true as const, employeeId: existing.id, createdEmployeeId: null }
  }

  if (!createMissingEmployees) {
    return {
      success: false as const,
      error: `Employee ${row.employeeName} is missing or inactive for this client.`,
    }
  }

  const { data: inserted, error } = await supabase
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

  if (error || !inserted?.id) {
    return {
      success: false as const,
      error: error?.message ?? `Unable to create employee ${row.employeeName}.`,
    }
  }

  return { success: true as const, employeeId: inserted.id, createdEmployeeId: inserted.id }
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

async function deletePayrollRunCascade(supabase: ServerSupabase, payrollRunId: string) {
  const { data: existingItems, error: itemReadError } = await supabase
    .from("payroll_run_items")
    .select("id")
    .eq("payroll_run_id", payrollRunId)

  if (itemReadError) {
    return false
  }

  const itemIds = (existingItems ?? []).map((item) => item.id)

  if (itemIds.length) {
    const { error: componentDeleteError } = await supabase
      .from("payroll_run_components")
      .delete()
      .in("run_item_id", itemIds)

    if (componentDeleteError) {
      return false
    }
  }

  const { error: itemDeleteError } = await supabase
    .from("payroll_run_items")
    .delete()
    .eq("payroll_run_id", payrollRunId)

  if (itemDeleteError) {
    return false
  }

  const { error: runDeleteError } = await supabase.from("payroll_runs").delete().eq("id", payrollRunId)
  return !runDeleteError
}

async function deleteVoucherSafely(supabase: ServerSupabase, clientId: string, voucherId: string) {
  const { error } = await supabase
    .from("vouchers")
    .delete()
    .eq("id", voucherId)
    .eq("client_id", clientId)

  return !error
}

async function restorePayrollRunItemsSnapshot(
  supabase: ServerSupabase,
  payrollRunId: string,
  items: Pick<
    PayrollRunItemRow,
    | "id"
    | "employee_id"
    | "employee_name"
    | "designation"
    | "grade"
    | "gross_salary"
    | "total_additions"
    | "total_deductions"
    | "net_payable"
  >[],
  components: Pick<PayrollRunComponentRow, "run_item_id" | "code" | "label" | "kind" | "amount">[]
) {
  const { data: currentItems, error: currentItemsError } = await supabase
    .from("payroll_run_items")
    .select("id")
    .eq("payroll_run_id", payrollRunId)

  if (currentItemsError) {
    return false
  }

  const currentItemIds = (currentItems ?? []).map((item) => item.id)

  if (currentItemIds.length) {
    const { error: componentDeleteError } = await supabase
      .from("payroll_run_components")
      .delete()
      .in("run_item_id", currentItemIds)

    if (componentDeleteError) {
      return false
    }
  }

  const { error: itemDeleteError } = await supabase
    .from("payroll_run_items")
    .delete()
    .eq("payroll_run_id", payrollRunId)

  if (itemDeleteError) {
    return false
  }

  if (!items.length) {
    return true
  }

  const { error: itemInsertError } = await supabase.from("payroll_run_items").insert(
    items.map((item) => ({
      id: item.id,
      payroll_run_id: payrollRunId,
      employee_id: item.employee_id,
      employee_name: item.employee_name,
      designation: item.designation,
      grade: item.grade,
      gross_salary: item.gross_salary,
      total_additions: item.total_additions,
      total_deductions: item.total_deductions,
      net_payable: item.net_payable,
    }))
  )

  if (itemInsertError) {
    return false
  }

  if (!components.length) {
    return true
  }

  const { error: componentInsertError } = await supabase.from("payroll_run_components").insert(
    components.map((component) => ({
      run_item_id: component.run_item_id,
      code: component.code,
      label: component.label,
      kind: component.kind,
      amount: component.amount,
    }))
  )

  return !componentInsertError
}

async function getValidatedPayrollMappings(supabase: ServerSupabase, clientId: string) {
  await ensurePayrollAccountMappings(supabase, clientId)

  const { data: mappings, error: mappingsError } = await supabase
    .from("payroll_account_mappings")
    .select("*")
    .eq("client_id", clientId)

  if (mappingsError) {
    return { success: false as const, error: mappingsError.message }
  }

  const accountHeadIds = Array.from(new Set((mappings ?? []).map((mapping) => mapping.account_head_id)))
  const { data: accountHeads, error: accountHeadsError } = accountHeadIds.length
    ? await supabase
        .from("account_heads")
        .select("id, client_id, is_active")
        .in("id", accountHeadIds)
    : { data: [], error: null }

  if (accountHeadsError) {
    return { success: false as const, error: accountHeadsError.message }
  }

  const accountHeadMap = new Map((accountHeads ?? []).map((head) => [head.id, head]))
  const defaultsByCode = new Map(
    PAYROLL_ACCOUNT_DEFAULTS.map((definition) => [
      definition.mappingCode,
      {
        accountsGroup: definition.groupType,
      },
    ])
  )

  const mappingRecord: Record<string, { accountHeadId: string; accountsGroup: AccountGroupType } | undefined> = {}

  for (const mapping of mappings ?? []) {
    const accountHead = accountHeadMap.get(mapping.account_head_id)
    const defaultDefinition = defaultsByCode.get(mapping.component_code)

    if (!accountHead || !defaultDefinition || accountHead.client_id !== clientId || accountHead.is_active === false) {
      return {
        success: false as const,
        error: "Payroll account mappings must point to active account heads in the same client.",
      }
    }

    mappingRecord[mapping.component_code] = {
      accountHeadId: mapping.account_head_id,
      accountsGroup: defaultDefinition.accountsGroup,
    }
  }

  return { success: true as const, mappings: mappingRecord }
}

async function resolvePayrollPaymentAccount(
  supabase: ServerSupabase,
  clientId: string,
  input: {
    paymentModeId?: string
    paymentModeName?: string
  }
) {
  const normalizedPaymentModeName = input.paymentModeName?.trim() || ""
  const { data: paymentMode } = input.paymentModeId
    ? await supabase
        .from("payment_modes")
        .select("*")
        .eq("id", input.paymentModeId)
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle()
    : normalizedPaymentModeName
      ? await supabase
          .from("payment_modes")
          .select("*")
          .eq("client_id", clientId)
          .eq("name", normalizedPaymentModeName)
          .eq("is_active", true)
          .maybeSingle()
      : { data: null }

  const accountHeadName = paymentMode?.name ?? normalizedPaymentModeName

  if (!accountHeadName) {
    return {
      success: false as const,
      error: "Select a payment mode before posting payroll payment.",
    }
  }

  if (!paymentMode) {
    return {
      success: false as const,
      error: "Select a valid payment mode before posting payroll payment.",
    }
  }

  const accountHead = await resolvePaymentModeAccountHead(supabase, {
    clientId,
    paymentMode,
  })

  if (!accountHead.success) {
    return { success: false as const, error: accountHead.error }
  }

  const validation = validatePaymentAccountHead({
    clientId,
    accountHead: {
      id: accountHead.accountHead.id,
      clientId: accountHead.accountHead.client_id,
      isActive: accountHead.accountHead.is_active,
      type: accountHead.accountHead.type,
    },
  })

  if (!validation.ok) {
    return { success: false as const, error: validation.error }
  }

  return {
    success: true as const,
    paymentAccountHeadId: accountHead.accountHead.id,
  }
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

  const period = getMonthPeriod(parsed.data.month)
  const periodValidation = validatePayrollPeriodWithinFiscalYear({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    fiscalYearStart: fiscalYear.start_date,
    fiscalYearEnd: fiscalYear.end_date,
  })

  if (!periodValidation.ok) {
    return { success: false as const, error: periodValidation.error }
  }

  const rows = normalizePayrollRows(parsed.data.rows)
  if (!rows.length) {
    return { success: false as const, error: "Payroll run needs at least one payable row." }
  }

  const { data: existingRun } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", fiscalYear.id)
    .eq("period_label", period.periodLabel)
    .maybeSingle()

  const duplicateValidation = validateDuplicatePayrollRun(Boolean(existingRun?.id))
  if (!duplicateValidation.ok) {
    return { success: false as const, error: duplicateValidation.error }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let payrollRunId: string | null = null
  const createdEmployeeIds: string[] = []

  const creationResult = await runPayrollCompensatingAction({
    perform: async () => {
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
        throw new Error(runError?.message ?? "Unable to create payroll run.")
      }

      payrollRunId = payrollRun.id

      for (const row of rows) {
        const employeeResolution = await findOrCreateEmployee(
          supabase,
          client.id,
          row,
          parsed.data.createMissingEmployees
        )

        if (!employeeResolution.success) {
          throw new Error(employeeResolution.error)
        }

        if (employeeResolution.createdEmployeeId) {
          createdEmployeeIds.push(employeeResolution.createdEmployeeId)
        }

        const summary = calculatePayrollRowSummary(row.components)

        const { data: item, error: itemError } = await supabase
          .from("payroll_run_items")
          .insert({
            payroll_run_id: payrollRun.id,
            employee_id: employeeResolution.employeeId,
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
          throw new Error(itemError?.message ?? "Unable to create payroll row.")
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
          throw new Error(componentError.message ?? "Unable to create payroll components.")
        }
      }

      return payrollRun
    },
    rollback: async () => {
      const runDeleted = payrollRunId ? await deletePayrollRunCascade(supabase, payrollRunId) : true

      let employeesDeleted = true
      if (createdEmployeeIds.length) {
        const { error } = await supabase.from("payroll_employees").delete().in("id", createdEmployeeIds)
        employeesDeleted = !error
      }

      return runDeleted && employeesDeleted
    },
    rollbackFailureMessage:
      "Payroll run creation failed and the rollback could not fully remove the partial payroll state.",
  })

  if (!creationResult.ok || !payrollRunId) {
    return { success: false as const, error: creationResult.error }
  }

  await recordPayrollAuditTrail(supabase, {
    payrollRunId,
    action: "created",
    details: `Payroll run created from ${parsed.data.source === "import" ? "Excel import" : "saved salary setup"}.`,
    userId: user?.id,
  })

  revalidatePayrollPaths(client.id, payrollRunId)
  return { success: true as const, payrollRunId }
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

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("is_closed")
    .eq("id", payrollRun.fiscal_year_id)
    .eq("client_id", client.id)
    .maybeSingle()

  const deleteValidation = validatePayrollLifecycle({
    operation: "delete",
    status: payrollRun.status,
    isFiscalYearClosed: fiscalYear?.is_closed,
    accrualVoucherId: payrollRun.accrual_voucher_id,
    paymentVoucherId: payrollRun.payment_voucher_id,
  })

  if (!deleteValidation.ok) {
    return { success: false as const, error: deleteValidation.error }
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

  const { data: existingRun, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', parsed.data.payrollRunId)
    .eq('client_id', client.id)
    .single()

  if (runError || !existingRun) {
    return { success: false as const, error: "Payroll run not found." }
  }

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("is_closed")
    .eq("id", existingRun.fiscal_year_id)
    .eq("client_id", client.id)
    .maybeSingle()

  const editValidation = validatePayrollLifecycle({
    operation: "edit",
    status: existingRun.status,
    isFiscalYearClosed: fiscalYear?.is_closed,
    accrualVoucherId: existingRun.accrual_voucher_id,
    paymentVoucherId: existingRun.payment_voucher_id,
  })

  if (!editValidation.ok) {
    return { success: false as const, error: editValidation.error }
  }

  const { data: snapshotItems } = await supabase
    .from("payroll_run_items")
    .select("id, employee_id, employee_name, designation, grade, gross_salary, total_additions, total_deductions, net_payable")
    .eq("payroll_run_id", parsed.data.payrollRunId)

  const { data: snapshotComponents } = await supabase
    .from("payroll_run_components")
    .select("run_item_id, code, label, kind, amount")
    .in("run_item_id", (snapshotItems ?? []).map((item) => item.id))

  for (const item of parsed.data.items) {
    const summary = calculatePayrollRowSummary(item.components)

    // Update item
    const { error: itemError } = await supabase
      .from('payroll_run_items')
      .update({
        gross_salary: summary.grossSalary,
        total_additions: summary.totalAdditions,
        total_deductions: summary.totalDeductions,
        net_payable: summary.netPayable,
      } as PayrollRunItemUpdate)
      .eq('id', item.id)
      .eq('payroll_run_id', parsed.data.payrollRunId)

    if (itemError) {
      return { success: false as const, error: itemError.message ?? "Unable to update payroll item." }
    }

    const { error: deleteError } = await supabase
      .from('payroll_run_components')
      .delete()
      .eq('run_item_id', item.id)

    if (deleteError) {
      await restorePayrollRunItemsSnapshot(
        supabase,
        parsed.data.payrollRunId,
        (snapshotItems ?? []) as Pick<
          PayrollRunItemRow,
          "id" | "employee_id" | "employee_name" | "designation" | "grade" | "gross_salary" | "total_additions" | "total_deductions" | "net_payable"
        >[],
        (snapshotComponents ?? []) as Pick<PayrollRunComponentRow, "run_item_id" | "code" | "label" | "kind" | "amount">[]
      )
      return { success: false as const, error: deleteError.message ?? "Unable to delete old components." }
    }

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
        await restorePayrollRunItemsSnapshot(
          supabase,
          parsed.data.payrollRunId,
          (snapshotItems ?? []) as Pick<
            PayrollRunItemRow,
            "id" | "employee_id" | "employee_name" | "designation" | "grade" | "gross_salary" | "total_additions" | "total_deductions" | "net_payable"
          >[],
          (snapshotComponents ?? []) as Pick<PayrollRunComponentRow, "run_item_id" | "code" | "label" | "kind" | "amount">[]
        )
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

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("is_closed")
    .eq("id", payrollRun.fiscal_year_id)
    .eq("client_id", client.id)
    .maybeSingle()

  const rerunValidation = validatePayrollLifecycle({
    operation: "rerun",
    status: payrollRun.status,
    isFiscalYearClosed: fiscalYear?.is_closed,
    accrualVoucherId: payrollRun.accrual_voucher_id,
    paymentVoucherId: payrollRun.payment_voucher_id,
  })

  if (!rerunValidation.ok) {
    return { success: false as const, error: rerunValidation.error }
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
    .select("id, employee_id, employee_name, designation, grade, gross_salary, total_additions, total_deductions, net_payable")
    .eq("payroll_run_id", payrollRun.id)

  const existingItemIds = (existingItems ?? []).map((item) => item.id)
  const { data: existingComponents } = existingItemIds.length
    ? await supabase
        .from("payroll_run_components")
        .select("run_item_id, code, label, kind, amount")
        .in("run_item_id", existingItemIds)
    : { data: [] }

  const rerunResult = await runPayrollCompensatingAction({
    perform: async () => {
      if (existingItemIds.length) {
        const { error: componentDeleteError } = await supabase
          .from("payroll_run_components")
          .delete()
          .in("run_item_id", existingItemIds)

        if (componentDeleteError) {
          throw new Error(componentDeleteError.message ?? "Unable to clear payroll components.")
        }
      }

      const { error: itemDeleteError } = await supabase
        .from("payroll_run_items")
        .delete()
        .eq("payroll_run_id", payrollRun.id)

      if (itemDeleteError) {
        throw new Error(itemDeleteError.message ?? "Unable to clear payroll rows.")
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
          throw new Error(itemError?.message ?? "Unable to recreate payroll rows.")
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
          throw new Error(componentError.message ?? "Unable to recreate payroll components.")
        }
      }
    },
    rollback: async () =>
      restorePayrollRunItemsSnapshot(
        supabase,
        payrollRun.id,
        (existingItems ?? []) as Pick<
          PayrollRunItemRow,
          "id" | "employee_id" | "employee_name" | "designation" | "grade" | "gross_salary" | "total_additions" | "total_deductions" | "net_payable"
        >[],
        (existingComponents ?? []) as Pick<PayrollRunComponentRow, "run_item_id" | "code" | "label" | "kind" | "amount">[]
      ),
    rollbackFailureMessage:
      "Payroll rerun failed and the previous draft rows could not be restored completely.",
  })

  if (!rerunResult.ok) {
    return { success: false as const, error: rerunResult.error }
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
  const lifecycleValidation = validatePayrollLifecycle({
    operation: "post-accrual",
    status: payrollRun.status,
    isFiscalYearClosed: fiscalYear.is_closed,
    accrualVoucherId: payrollRun.accrual_voucher_id,
    paymentVoucherId: payrollRun.payment_voucher_id,
  })

  if (!lifecycleValidation.ok) {
    return { success: false as const, error: lifecycleValidation.error }
  }

  const mappingsResult = await getValidatedPayrollMappings(supabase, client.id)
  if (!mappingsResult.success) {
    return mappingsResult
  }

  const netPayable = Number(items.reduce((sum, item) => sum + Number(item.net_payable ?? 0), 0).toFixed(2))

  const accrualLines = buildPayrollAccrualVoucherLines({
    components: components
      .map((component) => {
        const definition = PAYROLL_COMPONENTS[component.code as PayrollComponentCode]
        if (!definition) {
          return null
        }

        return {
          mappingCode: definition.mappingCode,
          kind: definition.kind,
          amount: Number(component.amount ?? 0),
        }
      })
      .filter(Boolean) as Array<{ mappingCode: string; kind: typeof components[number]["kind"]; amount: number }>,
    netPayable,
    mappingsByCode: mappingsResult.mappings,
    periodLabel: payrollRun.period_label,
  })

  if (!accrualLines.ok) {
    return { success: false as const, error: accrualLines.error }
  }

  const result = await createVoucherAction({
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
    voucherDate: parsed.data.voucherDate,
    voucherType: "journal",
    description: `Payroll accrual for ${payrollRun.period_label}`,
    showDescription: true,
    showSupportingDocuments: false,
    lines: accrualLines.lines,
  })

  if (!result.success) return result

  const { data: updatedRun, error } = await supabase
    .from("payroll_runs")
    .update({
      status: "posted",
      accrual_voucher_id: result.voucherId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRun.id)
    .eq("status", payrollRun.status)
    .is("accrual_voucher_id", null)
    .is("payment_voucher_id", null)
    .select("id")
    .maybeSingle()

  if (error || !updatedRun) {
    await deleteVoucherSafely(supabase, client.id, result.voucherId)
    return {
      success: false as const,
      error: error?.message ?? "Unable to link payroll voucher.",
    }
  }

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
  const lifecycleValidation = validatePayrollLifecycle({
    operation: "post-payment",
    status: payrollRun.status,
    isFiscalYearClosed: fiscalYear.is_closed,
    accrualVoucherId: payrollRun.accrual_voucher_id,
    paymentVoucherId: payrollRun.payment_voucher_id,
  })

  if (!lifecycleValidation.ok) {
    return { success: false as const, error: lifecycleValidation.error }
  }

  const mappingsResult = await getValidatedPayrollMappings(supabase, client.id)
  if (!mappingsResult.success) {
    return mappingsResult
  }

  const salaryPayableHead = mappingsResult.mappings.salary_payable?.accountHeadId
  const netPayable = Number(items.reduce((sum, item) => sum + Number(item.net_payable ?? 0), 0).toFixed(2))

  const paymentAccountResult = await resolvePayrollPaymentAccount(supabase, client.id, {
    paymentModeId: parsed.data.paymentModeId,
    paymentModeName: parsed.data.paymentModeName,
  })

  if (!paymentAccountResult.success) {
    return paymentAccountResult
  }

  const paymentLines = buildPayrollPaymentVoucherLines({
    salaryPayableHeadId: salaryPayableHead ?? "",
    paymentAccountHeadId: paymentAccountResult.paymentAccountHeadId,
    amount: netPayable,
    periodLabel: payrollRun.period_label,
  })

  if (!paymentLines.ok) {
    return { success: false as const, error: paymentLines.error }
  }

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
    lines: paymentLines.lines,
  })

  if (!result.success) return result

  const { data: updatedRun, error } = await supabase
    .from("payroll_runs")
    .update({
      status: "paid",
      payment_voucher_id: result.voucherId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRun.id)
    .eq("status", payrollRun.status)
    .not("accrual_voucher_id", "is", null)
    .is("payment_voucher_id", null)
    .select("id")
    .maybeSingle()

  if (error || !updatedRun) {
    await deleteVoucherSafely(supabase, client.id, result.voucherId)
    return {
      success: false as const,
      error: error?.message ?? "Unable to link payroll payment voucher.",
    }
  }

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
