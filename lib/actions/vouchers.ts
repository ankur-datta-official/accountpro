"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getMonthLabel } from "@/lib/accounting/fiscal-year"
import { AUTO_BALANCE_ENTRY_PREFIX } from "@/lib/accounting/vouchers"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

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
  description: z.string().optional(),
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

const openingBalanceLineSchema = z.object({
  accountHeadId: z.string().min(1),
  accountsGroup: z.enum(["asset", "liability"]),
  debitAmount: z.number().min(0),
  creditAmount: z.number().min(0),
})

const saveOpeningBalancesSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  lines: z.array(openingBalanceLineSchema).min(1),
})

export type UpdateVoucherInput = z.input<typeof updateVoucherSchema>
export type SaveOpeningBalancesInput = z.input<typeof saveOpeningBalancesSchema>

type ServerSupabase = ReturnType<typeof createClient>

type ValidatedContext = {
  supabase: ServerSupabase
  client: Database["public"]["Tables"]["clients"]["Row"]
  fiscalYear: Database["public"]["Tables"]["fiscal_years"]["Row"]
  userId: string | null
}

async function getValidatedVoucherContext(clientId: string, fiscalYearId: string) {
  const supabase = createClient()
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
    .eq("id", clientId)
    .eq("org_id", membership.org_id)
    .maybeSingle()

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
    paymentModeId,
    lines,
  }: {
    clientId: string
    voucherId: string
    voucherType: CreateVoucherInput["voucherType"]
    paymentModeId?: string
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

  if (!paymentModeId) {
    return {
      success: false as const,
      error: "Payment mode is required for unbalanced payment or received vouchers.",
    }
  }

  const { data: paymentMode } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("id", paymentModeId)
    .eq("client_id", clientId)
    .maybeSingle()

  if (!paymentMode) {
    return {
      success: false as const,
      error: "Selected payment mode could not be resolved.",
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

  const values = parsed.data
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

  const { difference } = getEntryTotals(values.lines)
  const requiresPaymentModeBalance =
    ["payment", "received"].includes(values.voucherType) && difference !== 0

  if (!["payment", "received"].includes(values.voucherType) && difference !== 0) {
    return {
      success: false as const,
      error: "Total debit and total credit must be balanced.",
    }
  }

  if (requiresPaymentModeBalance && !values.paymentModeId) {
    return {
      success: false as const,
      error: "Payment mode is required for unbalanced payment or received vouchers.",
    }
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
        values.voucherType === "payment" || values.voucherType === "received"
          ? values.paymentModeId ?? null
          : null,
      description: values.description || null,
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
    paymentModeId: requiresPaymentModeBalance ? values.paymentModeId : undefined,
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

export async function updateVoucherAction(input: UpdateVoucherInput) {
  const parsed = updateVoucherSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid voucher data.",
    }
  }

  const values = parsed.data
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

  if (fiscalYear.is_closed) {
    return {
      success: false as const,
      error: "You cannot edit a voucher in a closed fiscal year.",
    }
  }

  const { difference } = getEntryTotals(values.lines)
  const requiresPaymentModeBalance =
    ["payment", "received"].includes(values.voucherType) && difference !== 0

  if (!["payment", "received"].includes(values.voucherType) && difference !== 0) {
    return {
      success: false as const,
      error: "Total debit and total credit must be balanced.",
    }
  }

  const voucherNo = await getVoucherNumber(supabase, {
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
    desiredVoucherNo: values.voucherNo,
    voucherId: existingVoucher.id,
  })
  const monthLabel = getMonthLabel(new Date(values.voucherDate))

  const { error: voucherError } = await supabase
    .from("vouchers")
    .update({
      voucher_no: voucherNo,
      voucher_date: values.voucherDate,
      voucher_type: values.voucherType,
      payment_mode_id:
        values.voucherType === "payment" || values.voucherType === "received"
          ? values.paymentModeId ?? null
          : null,
      description: values.description || null,
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

  const { error: deleteEntriesError } = await supabase
    .from("voucher_entries")
    .delete()
    .eq("voucher_id", existingVoucher.id)

  if (deleteEntriesError) {
    return {
      success: false as const,
      error: deleteEntriesError.message ?? "Unable to refresh voucher entries.",
    }
  }

  const entryResult = await buildVoucherEntries(supabase, {
    clientId: client.id,
    voucherId: existingVoucher.id,
    voucherType: values.voucherType,
    paymentModeId: requiresPaymentModeBalance ? values.paymentModeId : undefined,
    lines: values.lines,
  })

  if (!entryResult.success) {
    return entryResult
  }

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

  const supabase = createClient()
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
    .eq("id", parsed.data.clientId)
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

  const supabase = createClient()
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
    .eq("id", parsed.data.clientId)
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

export async function saveOpeningBalancesAction(input: SaveOpeningBalancesInput) {
  const parsed = saveOpeningBalancesSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid opening balance data.",
    }
  }

  const values = parsed.data
  const validation = await getValidatedVoucherContext(values.clientId, values.fiscalYearId)

  if (!validation.success) {
    return validation
  }

  const { supabase, client, fiscalYear, userId } = validation.context

  if (fiscalYear.is_closed) {
    return {
      success: false as const,
      error: "You cannot update opening balances for a closed fiscal year.",
    }
  }

  const totalDebit = values.lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0)
  const totalCredit = values.lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0)
  const difference = Number((totalDebit - totalCredit).toFixed(2))

  if (difference !== 0) {
    return {
      success: false as const,
      error: "Opening balances must be fully balanced before saving.",
    }
  }

  const { data: existingOpeningVouchers } = await supabase
    .from("vouchers")
    .select("id")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", fiscalYear.id)
    .eq("voucher_type", "bf")

  const existingVoucherIds = (existingOpeningVouchers ?? []).map((voucher) => voucher.id)

  if (existingVoucherIds.length) {
    await supabase.from("voucher_entries").delete().in("voucher_id", existingVoucherIds)
    await supabase.from("vouchers").delete().in("id", existingVoucherIds)
  }

  const voucherNo = await getVoucherNumber(supabase, {
    clientId: client.id,
    fiscalYearId: fiscalYear.id,
  })

  const { data: insertedVoucher, error: voucherError } = await supabase
    .from("vouchers")
    .insert({
      client_id: client.id,
      fiscal_year_id: fiscalYear.id,
      voucher_no: voucherNo,
      voucher_date: fiscalYear.start_date,
      voucher_type: "bf",
      payment_mode_id: null,
      description: "Opening Balance B/F",
      month_label: getMonthLabel(new Date(fiscalYear.start_date)),
      is_posted: true,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (voucherError || !insertedVoucher) {
    return {
      success: false as const,
      error: voucherError?.message ?? "Unable to create the opening balance voucher.",
    }
  }

  const nonZeroLines = values.lines.filter(
    (line) => Number(line.debitAmount || 0) > 0 || Number(line.creditAmount || 0) > 0
  )

  const voucherEntries = nonZeroLines.map((line) => ({
    voucher_id: insertedVoucher.id,
    account_head_id: line.accountHeadId,
    accounts_group: line.accountsGroup,
    debit: Number(line.debitAmount || 0),
    credit: Number(line.creditAmount || 0),
    description: "Last year Balance",
  }))

  if (voucherEntries.length) {
    const { error: entriesError } = await supabase.from("voucher_entries").insert(voucherEntries)

    if (entriesError) {
      await supabase.from("vouchers").delete().eq("id", insertedVoucher.id)
      return {
        success: false as const,
        error: entriesError.message ?? "Unable to save opening balance entries.",
      }
    }
  }

  for (const line of values.lines) {
    const openingBalance = Math.abs(Number(line.debitAmount || 0) - Number(line.creditAmount || 0))
    const balanceType = Number(line.creditAmount || 0) > Number(line.debitAmount || 0) ? "credit" : "debit"

    const { error: updateError } = await supabase
      .from("account_heads")
      .update({
        opening_balance: openingBalance,
        balance_type: openingBalance === 0 ? "debit" : balanceType,
      })
      .eq("id", line.accountHeadId)
      .eq("client_id", client.id)

    if (updateError) {
      return {
        success: false as const,
        error: updateError.message ?? "Unable to update account opening balances.",
      }
    }
  }

  revalidatePath(`/clients/${client.id}`)
  revalidatePath(`/clients/${client.id}/settings`)
  revalidatePath(`/clients/${client.id}/vouchers`)
  revalidatePath(`/clients/${client.id}/vouchers/new`)
  revalidatePath(`/clients/${client.id}/vouchers/opening-balance`)

  return {
    success: true as const,
    voucherId: insertedVoucher.id,
    voucherNo,
  }
}
