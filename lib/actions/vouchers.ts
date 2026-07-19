"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getMonthLabel } from "@/lib/accounting/fiscal-year"
import { resolveOrCreatePaymentMode, resolvePaymentModeAccountHead } from "@/lib/accounting/payment-modes"
import {
  runAtomicVoucherOperation,
  validateVoucherAccountHeads,
  validateVoucherDateInFiscalYear,
  validateVoucherLines,
  validateVoucherMutationPolicy,
} from "@/lib/accounting/voucher-integrity"
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
  debitAmount: z.number().finite().min(0),
  creditAmount: z.number().finite().min(0),
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

const reverseVoucherSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  voucherId: z.string().min(1),
  reversalDate: z.string().min(1),
  reversalReason: z.string().trim().min(1, "Reversal reason is required."),
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
export type ReverseVoucherInput = z.input<typeof reverseVoucherSchema>
export type RegisterVoucherAttachmentsInput = z.input<typeof registerVoucherAttachmentsSchema>

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type ClientRow = Database["public"]["Tables"]["clients"]["Row"]
type AccountHeadRow = Database["public"]["Tables"]["account_heads"]["Row"]
type VoucherRow = Database["public"]["Tables"]["vouchers"]["Row"]
type VoucherEntryRow = Database["public"]["Tables"]["voucher_entries"]["Row"]
type FiscalYearRow = Database["public"]["Tables"]["fiscal_years"]["Row"]

type VoucherReversalSeed = Pick<
  VoucherRow,
  | "id"
  | "client_id"
  | "fiscal_year_id"
  | "voucher_no"
  | "voucher_date"
  | "voucher_type"
  | "payment_mode_id"
  | "show_description"
  | "description"
  | "show_supporting_documents"
  | "month_label"
  | "is_posted"
  | "is_reversal"
  | "reversal_reason"
  | "reversed_at"
  | "reversed_by"
  | "reversed_voucher_id"
  | "reversal_voucher_id"
>

type VoucherReversalEntrySeed = Pick<
  VoucherEntryRow,
  "account_head_id" | "accounts_group" | "debit" | "credit" | "description"
>

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

async function validateVoucherAccountOwnership(
  supabase: ServerSupabase,
  clientId: string,
  lines: CreateVoucherInput["lines"]
) {
  const uniqueAccountHeadIds = Array.from(new Set(lines.map((line) => line.accountHeadId)))

  const { data: accountHeads, error } = await supabase
    .from("account_heads")
    .select("id, client_id, sub_group_id, is_active, type")
    .in("id", uniqueAccountHeadIds)
    .eq("client_id", clientId)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to validate voucher account heads.",
    }
  }

  const result = validateVoucherAccountHeads({
    clientId,
    lines,
    accountHeads: (accountHeads ?? []) as Pick<
      AccountHeadRow,
      "id" | "client_id" | "sub_group_id" | "is_active" | "type"
    >[],
  })

  if (!result.ok) {
    return {
      success: false as const,
      error: result.error,
    }
  }

  return {
    success: true as const,
  }
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
    paymentMode,
    lines,
    requiresAutoBalance,
  }: {
    clientId: string
    voucherId: string
    paymentMode?: Database["public"]["Tables"]["payment_modes"]["Row"]
    lines: CreateVoucherInput["lines"]
    requiresAutoBalance: boolean
  }
) {
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

  if (!requiresAutoBalance) {
    return { success: true as const, entries: voucherEntries }
  }

  if (!paymentMode) {
    return {
      success: false as const,
      error: "Payment mode is required for unbalanced payment or received vouchers.",
    }
  }

  const resolvedPaymentModeHead = await resolvePaymentModeAccountHead(supabase, {
    clientId,
    paymentMode,
  })

  if (!resolvedPaymentModeHead.success) {
    return {
      success: false as const,
      error: resolvedPaymentModeHead.error,
    }
  }

  const paymentModeHead = resolvedPaymentModeHead.accountHead

  if (lines.some((line) => line.accountHeadId === paymentModeHead.id)) {
    return {
      success: false as const,
      error: "Add the payment-mode account explicitly or let the system balance it, but do not do both.",
    }
  }

  const { difference } = getEntryTotals(lines)

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

function buildReversalDescription({
  originalVoucherNo,
  originalDescription,
  reversalReason,
}: {
  originalVoucherNo: number
  originalDescription: string | null
  reversalReason: string
}) {
  const parts = [originalDescription?.trim() || null, `Reversal of voucher #${originalVoucherNo}`, `Reason: ${reversalReason}`]

  return parts.filter((part): part is string => Boolean(part)).join(" | ")
}

function prepareVoucherReversal({
  voucher,
  entries,
  targetClientId,
  targetFiscalYear,
  reversalDate,
  reversalReason,
  reversedBy,
  nextVoucherNo,
  now = new Date().toISOString(),
}: {
  voucher: VoucherReversalSeed
  entries: VoucherReversalEntrySeed[]
  targetClientId: string
  targetFiscalYear: Pick<FiscalYearRow, "id" | "client_id" | "start_date" | "end_date" | "is_active" | "is_closed">
  reversalDate: string
  reversalReason: string
  reversedBy: string | null
  nextVoucherNo: number
  now?: string
}) {
  const normalizedReason = reversalReason.trim()

  if (!normalizedReason) {
    return {
      ok: false as const,
      error: "Reversal reason is required.",
    }
  }

  if (voucher.client_id !== targetClientId) {
    return {
      ok: false as const,
      error: "Voucher not found.",
    }
  }

  if (voucher.is_posted === false) {
    return {
      ok: false as const,
      error: "Only posted vouchers can be reversed.",
    }
  }

  if (voucher.is_reversal || voucher.reversed_voucher_id) {
    return {
      ok: false as const,
      error: "Reversal vouchers cannot be reversed again.",
    }
  }

  if (voucher.reversal_voucher_id || voucher.reversed_at) {
    return {
      ok: false as const,
      error: "This voucher has already been reversed.",
    }
  }

  if (!targetFiscalYear.is_active || targetFiscalYear.is_closed) {
    return {
      ok: false as const,
      error: "Reversal date must belong to an open fiscal year.",
    }
  }

  const reversalDateValidation = validateVoucherDateInFiscalYear({
    expectedClientId: targetClientId,
    fiscalYearClientId: targetFiscalYear.client_id,
    voucherDate: reversalDate,
    fiscalYearStart: targetFiscalYear.start_date,
    fiscalYearEnd: targetFiscalYear.end_date,
  })

  if (!reversalDateValidation.ok) {
    return {
      ok: false as const,
      error: reversalDateValidation.error,
    }
  }

  if (!entries.length) {
    return {
      ok: false as const,
      error: "The original voucher has no entries to reverse.",
    }
  }

  const reversalEntries = entries.map((entry) => ({
    account_head_id: entry.account_head_id,
    accounts_group: entry.accounts_group,
    debit: Number(entry.credit || 0),
    credit: Number(entry.debit || 0),
    description: entry.description,
  }))

  return {
    ok: true as const,
    reversalVoucherInsert: {
      client_id: targetClientId,
      fiscal_year_id: targetFiscalYear.id,
      voucher_no: nextVoucherNo,
      voucher_date: reversalDateValidation.voucherDate,
      voucher_type: voucher.voucher_type,
      payment_mode_id: voucher.payment_mode_id,
      show_description: voucher.show_description,
      description: buildReversalDescription({
        originalVoucherNo: voucher.voucher_no,
        originalDescription: voucher.description,
        reversalReason: normalizedReason,
      }),
      show_supporting_documents: voucher.show_supporting_documents,
      month_label: getMonthLabel(new Date(reversalDateValidation.voucherDate)),
      is_posted: true,
      is_reversal: true,
      reversal_reason: normalizedReason,
      reversed_at: now,
      reversed_by: reversedBy,
      reversed_voucher_id: voucher.id,
      created_by: reversedBy,
      updated_at: now,
    } satisfies Database["public"]["Tables"]["vouchers"]["Insert"],
    reversalEntries,
    buildOriginalVoucherUpdate: (reversalVoucherId: string) =>
      ({
        reversal_voucher_id: reversalVoucherId,
        reversal_reason: normalizedReason,
        reversed_at: now,
        reversed_by: reversedBy,
        updated_at: now,
      }) satisfies Database["public"]["Tables"]["vouchers"]["Update"],
  }
}

async function applyVoucherReversalMutation({
  createReversalVoucher,
  insertReversalEntries,
  updateOriginalVoucher,
  rollbackReversalVoucher,
}: {
  createReversalVoucher: () => Promise<{ id: string }>
  insertReversalEntries: (reversalVoucherId: string) => Promise<void>
  updateOriginalVoucher: (reversalVoucherId: string) => Promise<void>
  rollbackReversalVoucher: (reversalVoucherId: string) => Promise<boolean>
}) {
  let reversalVoucherId: string | null = null

  return runAtomicVoucherOperation({
    perform: async () => {
      const createdVoucher = await createReversalVoucher()
      reversalVoucherId = createdVoucher.id
      await insertReversalEntries(createdVoucher.id)
      await updateOriginalVoucher(createdVoucher.id)
    },
    rollback: async () => {
      if (!reversalVoucherId) {
        return true
      }

      return rollbackReversalVoucher(reversalVoucherId)
    },
    failureMessage: "Unable to create voucher reversal.",
    rollbackFailureMessage:
      "Voucher reversal could not be completed safely because the rollback failed after the reversal began.",
  })
}

async function restoreVoucherUpdateSnapshot(
  supabase: ServerSupabase,
  {
    voucherId,
    previousVoucher,
    previousEntries,
  }: {
    voucherId: string
    previousVoucher: Pick<
      VoucherRow,
      | "voucher_no"
      | "voucher_date"
      | "voucher_type"
      | "fiscal_year_id"
      | "payment_mode_id"
      | "show_description"
      | "description"
      | "show_supporting_documents"
      | "month_label"
      | "updated_at"
    >
    previousEntries: Pick<
      VoucherEntryRow,
      "account_head_id" | "accounts_group" | "debit" | "credit" | "description"
    >[]
  }
) {
  const { error: voucherRestoreError } = await supabase
    .from("vouchers")
    .update(previousVoucher)
    .eq("id", voucherId)

  if (voucherRestoreError) {
    return false
  }

  const { error: clearEntriesError } = await supabase.from("voucher_entries").delete().eq("voucher_id", voucherId)

  if (clearEntriesError) {
    return false
  }

  if (!previousEntries.length) {
    return true
  }

  const { error: restoreEntriesError } = await supabase.from("voucher_entries").insert(
    previousEntries.map((entry) => ({
      voucher_id: voucherId,
      account_head_id: entry.account_head_id,
      accounts_group: entry.accounts_group,
      debit: entry.debit,
      credit: entry.credit,
      description: entry.description,
    }))
  )

  return !restoreEntriesError
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

  const fiscalYearDateValidation = validateVoucherDateInFiscalYear({
    expectedClientId: client.id,
    fiscalYearClientId: fiscalYear.client_id,
    voucherDate: values.voucherDate,
    fiscalYearStart: fiscalYear.start_date,
    fiscalYearEnd: fiscalYear.end_date,
  })

  if (!fiscalYearDateValidation.ok) {
    return {
      success: false as const,
      error: fiscalYearDateValidation.error,
    }
  }

  const lineRuleError = validateVoucherLineRules(values.lines)
  if (lineRuleError) {
    return {
      success: false as const,
      error: lineRuleError,
    }
  }

  const lineValidation = validateVoucherLines(values.lines, values.voucherType)
  if (!lineValidation.ok) {
    return {
      success: false as const,
      error: lineValidation.error,
    }
  }

  const accountOwnershipValidation = await validateVoucherAccountOwnership(supabase, client.id, values.lines)
  if (!accountOwnershipValidation.success) {
    return accountOwnershipValidation
  }

  const requiresPaymentModeSelection = ["payment", "received"].includes(values.voucherType)

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
    paymentMode: lineValidation.requiresAutoBalance ? paymentModeResult?.paymentMode : undefined,
    lines: values.lines,
    requiresAutoBalance: lineValidation.requiresAutoBalance,
  })

  if (!entryResult.success) {
    await supabase.from("vouchers").delete().eq("id", insertedVoucher.id)
    return entryResult
  }

  const createEntriesResult = await runAtomicVoucherOperation({
    perform: async () => {
      const { error: entryError } = await supabase.from("voucher_entries").insert(entryResult.entries)

      if (entryError) {
        throw new Error(entryError.message ?? "Unable to create voucher entries.")
      }
    },
    rollback: async () => {
      const { error } = await supabase.from("vouchers").delete().eq("id", insertedVoucher.id)
      return !error
    },
    failureMessage: "Unable to create voucher entries.",
    rollbackFailureMessage:
      "Voucher creation could not be completed safely because the rollback failed after entry creation was rejected.",
  })

  if (!createEntriesResult.ok) {
    return {
      success: false as const,
      error: createEntriesResult.error,
    }
  }

  revalidateVoucherPaths(client.id, insertedVoucher.id)

  return {
    success: true as const,
    voucherId: insertedVoucher.id,
    voucherNo,
  }
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

  const { supabase, client, fiscalYear } = validation.context

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

  const updatePolicy = validateVoucherMutationPolicy({
    operation: "update",
    isPosted: existingVoucher.is_posted,
    isFiscalYearClosed: fiscalYear.is_closed,
  })

  if (!updatePolicy.ok) {
    return {
      success: false as const,
      error: updatePolicy.error,
    }
  }

  if (existingVoucher.fiscal_year_id !== fiscalYear.id) {
    return {
      success: false as const,
      error: "Draft vouchers cannot be moved to a different fiscal year.",
    }
  }

  const fiscalYearDateValidation = validateVoucherDateInFiscalYear({
    expectedClientId: client.id,
    fiscalYearClientId: fiscalYear.client_id,
    voucherDate: values.voucherDate,
    fiscalYearStart: fiscalYear.start_date,
    fiscalYearEnd: fiscalYear.end_date,
  })

  if (!fiscalYearDateValidation.ok) {
    return {
      success: false as const,
      error: fiscalYearDateValidation.error,
    }
  }

  const lineRuleError = validateVoucherLineRules(values.lines)
  if (lineRuleError) {
    return {
      success: false as const,
      error: lineRuleError,
    }
  }

  const lineValidation = validateVoucherLines(values.lines, values.voucherType)
  if (!lineValidation.ok) {
    return {
      success: false as const,
      error: lineValidation.error,
    }
  }

  const accountOwnershipValidation = await validateVoucherAccountOwnership(supabase, client.id, values.lines)
  if (!accountOwnershipValidation.success) {
    return accountOwnershipValidation
  }

  const requiresPaymentModeSelection = ["payment", "received"].includes(values.voucherType)

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
    voucherId: existingVoucher.id,
  })
  const monthLabel = getMonthLabel(new Date(values.voucherDate))

  // Build new entries based on the LATEST data provided
  const entryResult = await buildVoucherEntries(supabase, {
    clientId: client.id,
    voucherId: existingVoucher.id,
    paymentMode: lineValidation.requiresAutoBalance ? paymentModeResult?.paymentMode : undefined,
    lines: values.lines,
    requiresAutoBalance: lineValidation.requiresAutoBalance,
  })

  if (!entryResult.success) {
    return entryResult
  }

  const { data: existingEntries, error: existingEntriesError } = await supabase
    .from("voucher_entries")
    .select("account_head_id, accounts_group, debit, credit, description")
    .eq("voucher_id", existingVoucher.id)

  if (existingEntriesError) {
    return {
      success: false as const,
      error: existingEntriesError.message ?? "Unable to read the current voucher entries before update.",
    }
  }

  const previousVoucherSnapshot = {
    voucher_no: existingVoucher.voucher_no,
    voucher_date: existingVoucher.voucher_date,
    voucher_type: existingVoucher.voucher_type,
    fiscal_year_id: existingVoucher.fiscal_year_id,
    payment_mode_id: existingVoucher.payment_mode_id,
    show_description: existingVoucher.show_description,
    description: existingVoucher.description,
    show_supporting_documents: existingVoucher.show_supporting_documents,
    month_label: existingVoucher.month_label,
    updated_at: existingVoucher.updated_at,
  } satisfies Pick<
    VoucherRow,
    | "voucher_no"
    | "voucher_date"
    | "voucher_type"
    | "fiscal_year_id"
    | "payment_mode_id"
    | "show_description"
    | "description"
    | "show_supporting_documents"
    | "month_label"
    | "updated_at"
  >

  const { error: voucherError } = await supabase
    .from("vouchers")
    .update({
      voucher_no: voucherNo,
      voucher_date: values.voucherDate,
      voucher_type: values.voucherType,
      fiscal_year_id: fiscalYear.id,
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

  const updateEntriesResult = await runAtomicVoucherOperation({
    perform: async () => {
      const { error: deleteEntriesError } = await supabase
        .from("voucher_entries")
        .delete()
        .eq("voucher_id", existingVoucher.id)

      if (deleteEntriesError) {
        throw new Error(deleteEntriesError.message ?? "Unable to refresh voucher entries.")
      }

      const { error: entryError } = await supabase.from("voucher_entries").insert(entryResult.entries)

      if (entryError) {
        throw new Error(entryError.message ?? "Unable to update voucher entries.")
      }
    },
    rollback: async () =>
      restoreVoucherUpdateSnapshot(supabase, {
        voucherId: existingVoucher.id,
        previousVoucher: previousVoucherSnapshot,
        previousEntries: (existingEntries ?? []) as Pick<
          VoucherEntryRow,
          "account_head_id" | "accounts_group" | "debit" | "credit" | "description"
        >[],
      }),
    failureMessage: "Unable to update voucher entries.",
    rollbackFailureMessage:
      "Voucher update could not be completed safely because restoring the previous voucher state failed.",
  })

  if (!updateEntriesResult.ok) {
    return {
      success: false as const,
      error: updateEntriesResult.error,
    }
  }

  revalidateVoucherPaths(client.id, existingVoucher.id)

  return {
    success: true as const,
    voucherId: existingVoucher.id,
    voucherNo,
  }
}

export async function reverseVoucherAction(input: ReverseVoucherInput) {
  const parsed = reverseVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid reversal request.",
    }
  }

  const validation = await getValidatedVoucherContext(parsed.data.clientId, parsed.data.fiscalYearId)

  if (!validation.success) {
    return validation
  }

  const { supabase, client, fiscalYear, userId } = validation.context

  const { data: voucher, error: voucherError } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", parsed.data.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (voucherError) {
    return {
      success: false as const,
      error: voucherError.message ?? "Unable to load voucher reversal source.",
    }
  }

  if (!voucher) {
    return {
      success: false as const,
      error: "Voucher not found.",
    }
  }

  const { data: originalEntries, error: entriesError } = await supabase
    .from("voucher_entries")
    .select("account_head_id, accounts_group, debit, credit, description")
    .eq("voucher_id", voucher.id)

  if (entriesError) {
    return {
      success: false as const,
      error: entriesError.message ?? "Unable to load voucher entries for reversal.",
    }
  }

  const reversalVoucherNo = await getVoucherNumber(supabase, {
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
  })

  const preparedReversal = prepareVoucherReversal({
    voucher: voucher as VoucherReversalSeed,
    entries: (originalEntries ?? []) as VoucherReversalEntrySeed[],
    targetClientId: client.id,
    targetFiscalYear: fiscalYear,
    reversalDate: parsed.data.reversalDate,
    reversalReason: parsed.data.reversalReason,
    reversedBy: userId,
    nextVoucherNo: reversalVoucherNo,
  })

  if (!preparedReversal.ok) {
    return {
      success: false as const,
      error: preparedReversal.error,
    }
  }

  const reversalResult = await applyVoucherReversalMutation({
    createReversalVoucher: async () => {
      const { data: createdVoucher, error } = await supabase
        .from("vouchers")
        .insert(preparedReversal.reversalVoucherInsert)
        .select("id")
        .single()

      if (error || !createdVoucher) {
        throw new Error(error?.message ?? "Unable to create reversal voucher.")
      }

      return createdVoucher
    },
    insertReversalEntries: async (reversalVoucherId) => {
      const { error } = await supabase.from("voucher_entries").insert(
        preparedReversal.reversalEntries.map((entry) => ({
          voucher_id: reversalVoucherId,
          account_head_id: entry.account_head_id,
          accounts_group: entry.accounts_group,
          debit: entry.debit,
          credit: entry.credit,
          description: entry.description,
        }))
      )

      if (error) {
        throw new Error(error.message ?? "Unable to create reversal voucher entries.")
      }
    },
    updateOriginalVoucher: async (reversalVoucherId) => {
      const { error } = await supabase
        .from("vouchers")
        .update(preparedReversal.buildOriginalVoucherUpdate(reversalVoucherId))
        .eq("id", voucher.id)
        .is("reversal_voucher_id", null)

      if (error) {
        throw new Error(error.message ?? "Unable to link the original voucher to its reversal.")
      }

      const { data: linkedVoucher, error: linkedVoucherError } = await supabase
        .from("vouchers")
        .select("id")
        .eq("id", voucher.id)
        .eq("reversal_voucher_id", reversalVoucherId)
        .maybeSingle()

      if (linkedVoucherError || !linkedVoucher) {
        throw new Error(linkedVoucherError?.message ?? "Duplicate reversal detected for this voucher.")
      }
    },
    rollbackReversalVoucher: async (reversalVoucherId) => {
      const { error } = await supabase.from("vouchers").delete().eq("id", reversalVoucherId)
      return !error
    },
  })

  if (!reversalResult.ok) {
    return {
      success: false as const,
      error: reversalResult.error,
    }
  }

  revalidateVoucherPaths(client.id, voucher.id)

  return {
    success: true as const,
    voucherNo: reversalVoucherNo,
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

  const deletePolicy = validateVoucherMutationPolicy({
    operation: "delete",
    isPosted: voucher.is_posted,
    isFiscalYearClosed: fiscalYear?.is_closed,
  })

  if (!deletePolicy.ok) {
    return {
      success: false as const,
      error: deletePolicy.error,
    }
  }

  const { data: attachments } = await supabase
    .from("voucher_attachments")
    .select("file_path")
    .eq("voucher_id", voucher.id)

  const { error } = await supabase.from("vouchers").delete().eq("id", voucher.id)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to delete voucher.",
    }
  }

  if (attachments?.length) {
    await supabase.storage
      .from("voucher-documents")
      .remove(attachments.map((attachment) => attachment.file_path))
      .catch(() => undefined)
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

  const bulkPolicy = validateVoucherMutationPolicy({
    operation: "bulk-delete",
    isPosted: false,
    isFiscalYearClosed: false,
    requestedCount: parsed.data.voucherIds.length,
    matchedCount: vouchers?.length ?? 0,
  })

  if (!bulkPolicy.ok) {
    return {
      success: false as const,
      error: bulkPolicy.error,
    }
  }

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
        error: "Closed fiscal-year vouchers are immutable.",
      }
    }
  }

  if ((vouchers ?? []).some((voucher) => voucher.is_posted !== false)) {
    return {
      success: false as const,
      error: "Posted vouchers cannot be deleted directly.",
    }
  }

  const { data: attachments } = await supabase
    .from("voucher_attachments")
    .select("file_path")
    .in("voucher_id", parsed.data.voucherIds)

  const { error } = await supabase.from("vouchers").delete().in("id", parsed.data.voucherIds)

  if (error) {
    return {
      success: false as const,
      error: error.message ?? "Unable to delete selected vouchers.",
    }
  }

  if (attachments?.length) {
    await supabase.storage
      .from("voucher-documents")
      .remove(attachments.map((attachment) => attachment.file_path))
      .catch(() => undefined)
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
