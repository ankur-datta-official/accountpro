"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getMonthLabel } from "@/lib/accounting/fiscal-year"
import { resolveOrCreatePaymentMode } from "@/lib/accounting/payment-modes"
import {
  getVoucherLineAmountRuleError,
  normalizeVoucherLineAmounts,
} from "@/lib/accounting/voucher-entry-rules"
import { AUTO_BALANCE_ENTRY_PREFIX } from "@/lib/accounting/vouchers"
import { extractClientIdFromRouteSegment, isUuid, matchesClientRouteSegment } from "@/lib/routing/clients"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { Database, PaymentModeType } from "@/lib/types"

const voucherLineSchema = z.object({
  accountsGroup: z.enum(["expense", "income", "asset", "liability"]),
  accountHeadId: z.string().min(1),
  debitAmount: z.number().min(0),
  creditAmount: z.number().min(0),
  description: z.string().optional(),
})

const createVoucherSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  voucherNo: z.number().int().positive().optional(),
  voucherDate: z.string().min(1),
  voucherType: z.enum(["payment", "received", "journal", "contra", "bf", "bp", "br"]),
  paymentModeId: z.string().optional(),
  paymentModeName: z.string().optional(),
  paymentModeType: z.enum(["bank", "cash", "mobile_banking", "other"]).optional(),
  showDescription: z.boolean(),
  description: z.string().optional(),
  showSupportingDocuments: z.boolean(),
  lines: z.array(voucherLineSchema).min(1),
})

export type CreateVoucherInput = z.input<typeof createVoucherSchema>

const updateVoucherSchema = createVoucherSchema.extend({
  voucherId: z.string().min(1),
})

const deleteVoucherSchema = z.object({
  clientId: z.string().min(1),
  voucherId: z.string().min(1),
})

const bulkDeleteVoucherSchema = z.object({
  clientId: z.string().min(1),
  voucherIds: z.array(z.string().min(1)).min(1),
})

const voucherAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  filePath: z.string().trim().min(1).max(1000),
  fileSize: z.number().int().min(0).max(15 * 1024 * 1024),
  mimeType: z.string().trim().max(255).optional(),
})

const registerVoucherAttachmentsSchema = z.object({
  clientId: z.string().min(1),
  voucherId: z.string().min(1),
  attachments: z.array(voucherAttachmentSchema).min(1).max(10),
})

export type UpdateVoucherInput = z.input<typeof updateVoucherSchema>
export type RegisterVoucherAttachmentsInput = z.input<typeof registerVoucherAttachmentsSchema>

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type ClientRow = Database["public"]["Tables"]["clients"]["Row"]

type ValidatedContext = {
  supabase: ServerSupabase
  client: Database["public"]["Tables"]["clients"]["Row"]
  fiscalYear: Database["public"]["Tables"]["fiscal_years"]["Row"]
  userId: string | null
}

async function getValidatedVoucherContext(clientId: string, fiscalYearId: string) {
  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()
  const normalizedClientId = extractClientIdFromRouteSegment(clientId)

  if (!membership?.org_id) {
    return {
      success: false as const,
      error: "No active organization found.",
    }
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
    return {
      success: false as const,
      error: "Client not found.",
    }
  }

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", fiscalYearId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!fiscalYear) {
    return {
      success: false as const,
      error: "Fiscal year not found.",
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return {
    success: true as const,
    context: {
      supabase,
      client,
      fiscalYear,
      userId: user?.id ?? null,
    } satisfies ValidatedContext,
  }
}

function getEntryTotals(lines: CreateVoucherInput["lines"]) {
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0)
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0)
  const difference = Number((totalDebit - totalCredit).toFixed(2))

  return { totalDebit, totalCredit, difference }
}

function validateVoucherLineRules(lines: CreateVoucherInput["lines"]) {
  for (const line of lines) {
    const error = getVoucherLineAmountRuleError({
      accountsGroup: line.accountsGroup,
      debitAmount: Number(line.debitAmount || 0),
      creditAmount: Number(line.creditAmount || 0),
    })

    if (error) {
      return error
    }
  }

  return null
}

async function getVoucherNumber(
  supabase: ServerSupabase,
  {
    clientId,
    fiscalYearId,
    desiredVoucherNo,
    voucherId,
  }: {
    clientId: string
    fiscalYearId: string
    desiredVoucherNo?: number
    voucherId?: string
  }
) {
  const { data: existingVouchers } = await supabase
    .from("vouchers")
    .select("voucher_no")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .order("voucher_no", { ascending: false })
    .limit(1)

  const nextVoucherNo = Number(existingVouchers?.[0]?.voucher_no ?? 0) + 1
  const requestedVoucherNo = desiredVoucherNo && desiredVoucherNo > 0 ? desiredVoucherNo : nextVoucherNo

  let duplicateQuery = supabase
    .from("vouchers")
    .select("id")
    .eq("client_id", clientId)
    .eq("fiscal_year_id", fiscalYearId)
    .eq("voucher_no", requestedVoucherNo)

  if (voucherId) {
    duplicateQuery = duplicateQuery.neq("id", voucherId)
  }

  const { data: duplicateVoucher } = await duplicateQuery.maybeSingle()

  return duplicateVoucher ? nextVoucherNo : requestedVoucherNo
}

async function buildVoucherEntries(
  supabase: ServerSupabase,
  {
    clientId,
    voucherId,
    voucherType,
    paymentMode,
    lines,
  }: {
    clientId: string
    voucherId: string
    voucherType: CreateVoucherInput["voucherType"]
    paymentMode?: Database["public"]["Tables"]["payment_modes"]["Row"]
    lines: CreateVoucherInput["lines"]
  }
) {
  const { difference } = getEntryTotals(lines)
  const requiresPaymentModeBalance =
    ["payment", "received"].includes(voucherType) && difference !== 0

  const voucherEntries: Database["public"]["Tables"]["voucher_entries"]["Insert"][] = lines.map(
    (line) => ({
      voucher_id: voucherId,
      account_head_id: line.accountHeadId,
      accounts_group: line.accountsGroup,
      debit: Number(line.debitAmount || 0),
      credit: Number(line.creditAmount || 0),
      description: line.description || null,
    })
  )

  if (!requiresPaymentModeBalance) {
    return { success: true as const, entries: voucherEntries }
  }

  if (!paymentMode) {
    return {
      success: false as const,
      error: "Payment mode is required for unbalanced payment or received vouchers.",
    }
  }

  const { data: paymentModeHead } = await supabase
    .from("account_heads")
    .select("*")
    .eq("client_id", clientId)
    .eq("name", paymentMode.name)
    .maybeSingle()

  if (!paymentModeHead) {
    return {
      success: false as const,
      error: "No chart of accounts head matches the selected payment mode.",
    }
  }

  voucherEntries.push({
    voucher_id: voucherId,
    account_head_id: paymentModeHead.id,
    accounts_group: "asset",
    debit: difference < 0 ? Math.abs(difference) : 0,
    credit: difference > 0 ? Math.abs(difference) : 0,
    description: `${AUTO_BALANCE_ENTRY_PREFIX}${paymentMode.name}`,
  })

  return { success: true as const, entries: voucherEntries }
}

function revalidateVoucherPaths(clientId: string, voucherId?: string) {
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/vouchers`)
  revalidatePath(`/clients/${clientId}/vouchers/new`)
  revalidatePath(`/clients/${clientId}/ledger`)
  revalidatePath(`/clients/${clientId}/day-book`)
  revalidatePath(`/clients/${clientId}/daybook`)
  revalidatePath(`/clients/${clientId}/trial-balance`)
  revalidatePath(`/clients/${clientId}/profit-loss`)
  revalidatePath(`/clients/${clientId}/balance-sheet`)

  if (voucherId) {
    revalidatePath(`/clients/${clientId}/vouchers/${voucherId}`)
    revalidatePath(`/clients/${clientId}/vouchers/${voucherId}/edit`)
  }
}

export async function createVoucherAction(input: CreateVoucherInput) {
  const parsed = createVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid voucher data.",
    }
  }

  const values = {
    ...parsed.data,
    lines: parsed.data.lines.map((line) =>
      normalizeVoucherLineAmounts({
        ...line,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
      })
    ),
  }
  const validation = await getValidatedVoucherContext(values.clientId, values.fiscalYearId)

  if (!validation.success) {
    return validation
  }

  const { supabase, client, fiscalYear, userId } = validation.context

  if (!fiscalYear.is_active || fiscalYear.is_closed) {
    return {
      success: false as const,
      error: "The selected fiscal year is not active for voucher entry.",
    }
  }

  const lineRuleError = validateVoucherLineRules(values.lines)
  if (lineRuleError) {
    return {
      success: false as const,
      error: lineRuleError,
    }
  }

  const { difference } = getEntryTotals(values.lines)
  const requiresPaymentModeBalance =
    ["payment", "received"].includes(values.voucherType) && difference !== 0
  const requiresPaymentModeSelection = ["payment", "received"].includes(values.voucherType)

  if (!["payment", "received"].includes(values.voucherType) && difference !== 0) {
    return {
      success: false as const,
      error: "Total debit and total credit must be balanced.",
    }
  }

  if (requiresPaymentModeSelection && !values.paymentModeId && !values.paymentModeName) {
    return {
      success: false as const,
      error: "Payment mode is required for payment and received vouchers.",
    }
  }

  const paymentModeResult = requiresPaymentModeSelection
    ? await resolveOrCreatePaymentMode(supabase, {
        clientId: client.id,
        paymentModeId: values.paymentModeId,
        paymentModeName: values.paymentModeName,
        paymentModeType: values.paymentModeType as PaymentModeType | undefined,
      })
    : null

  if (paymentModeResult && !paymentModeResult.success) {
    return paymentModeResult
  }

  const voucherNo = await getVoucherNumber(supabase, {
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
    desiredVoucherNo: values.voucherNo,
  })
  const monthLabel = getMonthLabel(new Date(values.voucherDate))

  const { data: insertedVoucher, error: voucherError } = await supabase
    .from("vouchers")
    .insert({
      client_id: client.id,
      fiscal_year_id: fiscalYear.id,
      voucher_no: voucherNo,
      voucher_date: values.voucherDate,
      voucher_type: values.voucherType,
      payment_mode_id:
        values.voucherType === "payment" ||
        values.voucherType === "received" ||
        values.voucherType === "journal"
          ? paymentModeResult?.paymentMode.id ?? null
          : null,
      show_description: values.showDescription,
      description: values.description || null,
      show_supporting_documents: values.showSupportingDocuments,
      month_label: monthLabel,
      is_posted: true,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (voucherError || !insertedVoucher) {
    return {
      success: false as const,
      error: voucherError?.message ?? "Unable to create voucher.",
    }
  }

  const entryResult = await buildVoucherEntries(supabase, {
    clientId: client.id,
    voucherId: insertedVoucher.id,
    voucherType: values.voucherType,
    paymentMode: requiresPaymentModeBalance ? paymentModeResult?.paymentMode : undefined,
    lines: values.lines,
  })

  if (!entryResult.success) {
    await supabase.from("vouchers").delete().eq("id", insertedVoucher.id)
    return entryResult
  }

  const { error: entryError } = await supabase.from("voucher_entries").insert(entryResult.entries)

  if (entryError) {
    await supabase.from("vouchers").delete().eq("id", insertedVoucher.id)
    return {
      success: false as const,
      error: entryError.message ?? "Unable to create voucher entries.",
    }
  }

  revalidateVoucherPaths(client.id, insertedVoucher.id)

  return {
    success: true as const,
    voucherId: insertedVoucher.id,
    voucherNo,
  }
}

async function findFiscalYearForDate(
  supabase: ServerSupabase,
  clientId: string,
  date: string
) {
  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("client_id", clientId)
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle()

  return fiscalYear
}

export async function updateVoucherAction(input: UpdateVoucherInput) {
  const parsed = updateVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid voucher data.",
    }
  }

  const values = {
    ...parsed.data,
    lines: parsed.data.lines.map((line) =>
      normalizeVoucherLineAmounts({
        ...line,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
      })
    ),
  }
  const validation = await getValidatedVoucherContext(values.clientId, values.fiscalYearId)

  if (!validation.success) {
    return validation
  }

  const { supabase, client } = validation.context

  const { data: existingVoucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", values.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!existingVoucher) {
    return {
      success: false as const,
      error: "Voucher not found.",
    }
  }

  // Determine the correct fiscal year for the selected date
  const targetFiscalYear = await findFiscalYearForDate(supabase, client.id, values.voucherDate)

  if (!targetFiscalYear) {
    return {
      success: false as const,
      error: "No active fiscal year found for the selected voucher date. Please check your fiscal years in settings.",
    }
  }

  if (targetFiscalYear.is_closed) {
    return {
      success: false as const,
      error: "The fiscal year for the selected date is closed.",
    }
  }

  const lineRuleError = validateVoucherLineRules(values.lines)
  if (lineRuleError) {
    return {
      success: false as const,
      error: lineRuleError,
    }
  }

  const { difference } = getEntryTotals(values.lines)
  const requiresPaymentModeBalance =
    ["payment", "received"].includes(values.voucherType) && difference !== 0
  const requiresPaymentModeSelection = ["payment", "received"].includes(values.voucherType)

  if (!["payment", "received"].includes(values.voucherType) && difference !== 0) {
    return {
      success: false as const,
      error: "Total debit and total credit must be balanced.",
    }
  }

  if (requiresPaymentModeSelection && !values.paymentModeId && !values.paymentModeName) {
    return {
      success: false as const,
      error: "Payment mode is required for payment and received vouchers.",
    }
  }

  const paymentModeResult = requiresPaymentModeSelection
    ? await resolveOrCreatePaymentMode(supabase, {
        clientId: client.id,
        paymentModeId: values.paymentModeId,
        paymentModeName: values.paymentModeName,
        paymentModeType: values.paymentModeType as PaymentModeType | undefined,
      })
    : null

  if (paymentModeResult && !paymentModeResult.success) {
    return paymentModeResult
  }

  const voucherNo = await getVoucherNumber(supabase, {
    clientId: client.id,
    fiscalYearId: targetFiscalYear.id,
    desiredVoucherNo: values.voucherNo,
    voucherId: existingVoucher.id,
  })
  const monthLabel = getMonthLabel(new Date(values.voucherDate))

  // Build new entries based on the LATEST data provided
  const entryResult = await buildVoucherEntries(supabase, {
    clientId: client.id,
    voucherId: existingVoucher.id,
    voucherType: values.voucherType,
    paymentMode: requiresPaymentModeBalance ? paymentModeResult?.paymentMode : undefined,
    lines: values.lines,
  })

  if (!entryResult.success) {
    return entryResult
  }

  // Update voucher record
  const { error: voucherError } = await supabase
    .from("vouchers")
    .update({
      voucher_no: voucherNo,
      voucher_date: values.voucherDate,
      voucher_type: values.voucherType,
      fiscal_year_id: targetFiscalYear.id,
      payment_mode_id:
        values.voucherType === "payment" ||
        values.voucherType === "received" ||
        values.voucherType === "journal"
          ? paymentModeResult?.paymentMode.id ?? null
          : null,
      show_description: values.showDescription,
      description: values.description || null,
      show_supporting_documents: values.showSupportingDocuments,
      month_label: monthLabel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingVoucher.id)

  if (voucherError) {
    return {
      success: false as const,
      error: voucherError.message ?? "Unable to update voucher.",
    }
  }

  // Delete ALL existing entries first. The latest submitted lines are the only
  // source of truth for the voucher and every ledger/report derived from it.
  const { data: deletedEntries, error: deleteEntriesError } = await supabase
    .from("voucher_entries")
    .delete()
    .eq("voucher_id", existingVoucher.id)
    .select("id")

  if (deleteEntriesError) {
    return {
      success: false as const,
      error: deleteEntriesError.message ?? "Unable to refresh voucher entries.",
    }
  }

  const { count: remainingEntryCount, error: remainingEntriesError } = await supabase
    .from("voucher_entries")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", existingVoucher.id)

  if (remainingEntriesError) {
    return {
      success: false as const,
      error: remainingEntriesError.message ?? "Unable to verify voucher entries were refreshed.",
    }
  }

  if ((remainingEntryCount ?? 0) > 0) {
    return {
      success: false as const,
      error:
        "Unable to replace the old voucher entries. Please apply the latest database migration and try again.",
    }
  }

  if ((deletedEntries?.length ?? 0) === 0) {
    const { count: existingEntryCount, error: existingEntriesError } = await supabase
      .from("voucher_entries")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", existingVoucher.id)

    if (existingEntriesError) {
      return {
        success: false as const,
        error: existingEntriesError.message ?? "Unable to verify voucher entries before update.",
      }
    }

    if ((existingEntryCount ?? 0) > 0) {
      return {
        success: false as const,
        error:
          "Unable to clear the old voucher entries. Please apply the latest database migration and try again.",
      }
    }
  }

  // Insert NEW entries based on the latest updated data only.
  const { error: entryError } = await supabase.from("voucher_entries").insert(entryResult.entries)

  if (entryError) {
    return {
      success: false as const,
      error: entryError.message ?? "Unable to update voucher entries.",
    }
  }

  revalidateVoucherPaths(client.id, existingVoucher.id)

  return {
    success: true as const,
    voucherId: existingVoucher.id,
    voucherNo,
  }
}

export async function deleteVoucherAction(input: z.input<typeof deleteVoucherSchema>) {
  const parsed = deleteVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid delete request.",
    }
  }

  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()

  if (!membership?.org_id) {
    return {
      success: false as const,
      error: "No active organization found.",
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", extractClientIdFromRouteSegment(parsed.data.clientId))
    .eq("org_id", membership.org_id)
    .maybeSingle()

  if (!client) {
    return {
      success: false as const,
      error: "Client not found.",
    }
  }

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", parsed.data.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!voucher) {
    return {
      success: false as const,
      error: "Voucher not found.",
    }
  }

  const { data: fiscalYear } = await supabase
    .from("fiscal_years")
    .select("*")
    .eq("id", voucher.fiscal_year_id ?? "")
    .maybeSingle()

  if (fiscalYear?.is_closed) {
    return {
      success: false as const,
      error: "You cannot delete a voucher from a closed fiscal year.",
    }
  }

  const { data: attachments } = await supabase
    .from("voucher_attachments")
    .select("file_path")
    .eq("voucher_id", voucher.id)

  if (attachments?.length) {
    await supabase.storage
      .from("voucher-documents")
      .remove(attachments.map((attachment) => attachment.file_path))
  }

  const { error } = await supabase.from("vouchers").delete().eq("id", voucher.id)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to delete voucher.",
    }
  }

  revalidateVoucherPaths(client.id, voucher.id)

  return {
    success: true as const,
  }
}

export async function bulkDeleteVouchersAction(input: z.input<typeof bulkDeleteVoucherSchema>) {
  const parsed = bulkDeleteVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk delete request.",
    }
  }

  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()

  if (!membership?.org_id) {
    return {
      success: false as const,
      error: "No active organization found.",
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", extractClientIdFromRouteSegment(parsed.data.clientId))
    .eq("org_id", membership.org_id)
    .maybeSingle()

  if (!client) {
    return {
      success: false as const,
      error: "Client not found.",
    }
  }

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("*")
    .eq("client_id", client.id)
    .in("id", parsed.data.voucherIds)

  const fiscalYearIds = Array.from(
    new Set((vouchers ?? []).map((voucher) => voucher.fiscal_year_id).filter(Boolean) as string[])
  )

  if (fiscalYearIds.length) {
    const { data: fiscalYears } = await supabase
      .from("fiscal_years")
      .select("*")
      .in("id", fiscalYearIds)

    if ((fiscalYears ?? []).some((year) => year.is_closed)) {
      return {
        success: false as const,
        error: "One or more selected vouchers belong to a closed fiscal year.",
      }
    }
  }

  const { data: attachments } = await supabase
    .from("voucher_attachments")
    .select("file_path")
    .in("voucher_id", parsed.data.voucherIds)

  if (attachments?.length) {
    await supabase.storage
      .from("voucher-documents")
      .remove(attachments.map((attachment) => attachment.file_path))
  }

  const { error } = await supabase.from("vouchers").delete().in("id", parsed.data.voucherIds)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to delete selected vouchers.",
    }
  }

  revalidateVoucherPaths(client.id)

  return {
    success: true as const,
  }
}

export async function registerVoucherAttachmentsAction(input: RegisterVoucherAttachmentsInput) {
  const parsed = registerVoucherAttachmentsSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid attachment data.",
    }
  }

  const supabase = await createClient()
  const { membership } = await getCurrentOrganizationContext()

  if (!membership?.org_id) {
    return {
      success: false as const,
      error: "No active organization found.",
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", extractClientIdFromRouteSegment(parsed.data.clientId))
    .eq("org_id", membership.org_id)
    .maybeSingle()

  if (!client) {
    return {
      success: false as const,
      error: "Client not found.",
    }
  }

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", parsed.data.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!voucher) {
    return {
      success: false as const,
      error: "Voucher not found.",
    }
  }

  const expectedPrefix = `${client.id}/${voucher.id}/`
  const hasInvalidPath = parsed.data.attachments.some(
    (attachment) => !attachment.filePath.startsWith(expectedPrefix)
  )

  if (hasInvalidPath) {
    return {
      success: false as const,
      error: "One or more uploaded documents do not belong to this voucher.",
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("voucher_attachments").insert(
    parsed.data.attachments.map((attachment) => ({
      voucher_id: voucher.id,
      client_id: client.id,
      file_name: attachment.fileName,
      file_path: attachment.filePath,
      file_size: attachment.fileSize,
      mime_type: attachment.mimeType || null,
      uploaded_by: user?.id ?? null,
    }))
  )

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to save voucher attachments.",
    }
  }

  revalidateVoucherPaths(client.id, voucher.id)

  return {
    success: true as const,
  }
}
