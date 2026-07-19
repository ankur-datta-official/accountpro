import { NextResponse } from "next/server"
import { z } from "zod"

import {
  validateAccountHeadDeletion,
  validateParentAssignment,
} from "@/lib/accounting/account-head-integrity"
import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountHead, AccountHeadUpdate } from "@/lib/types"

const updateAccountHeadSchema = z.object({
  accountHeadName: z.string().trim().min(2, "Account head name is required."),
  openingBalance: z.coerce.number().default(0),
  balanceType: z.enum(["debit", "credit"]),
  is_active: z.boolean().default(true),
  parentAccountHeadId: z.string().nullable().optional(),
})

function createServiceRoleClient() {
  return supabaseAdmin
}

function sanitizeAccountHead(head: AccountHead): AccountHead {
  return {
    ...head,
    is_active: head.is_active ?? true,
  }
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string; accountHeadId: string }> }
) {
  const { clientId, accountHeadId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const { data: accountHead, error } = await supabase
    .from("account_heads")
    .select("*")
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!accountHead) {
    return NextResponse.json({ error: "Account head not found." }, { status: 404 })
  }

  return NextResponse.json(sanitizeAccountHead(accountHead))
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; accountHeadId: string }> }
) {
  const { clientId, accountHeadId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const body = await request.json().catch(() => null)
  const parsed = updateAccountHeadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid account head data." },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canWriteClientData(membership)) {
    return NextResponse.json(
      { error: "You do not have permission to modify account heads." },
      { status: 403 }
    )
  }

  const { data: currentHead } = await supabase
    .from("account_heads")
    .select("*")
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!currentHead) {
    return NextResponse.json({ error: "Account head not found." }, { status: 404 })
  }

  const { data: subgroupHeads, error: subgroupHeadError } = await supabase
    .from("account_heads")
    .select("*")
    .eq("client_id", client.id)
    .eq("sub_group_id", currentHead.sub_group_id ?? "")

  if (subgroupHeadError) {
    return NextResponse.json({ error: subgroupHeadError.message }, { status: 400 })
  }

  const parentValidation = validateParentAssignment({
    headId: currentHead.id,
    parentId:
      parsed.data.parentAccountHeadId === undefined
        ? currentHead.parent_id
        : parsed.data.parentAccountHeadId,
    clientId: client.id,
    subGroupId: currentHead.sub_group_id ?? "",
    heads: (subgroupHeads ?? []) as AccountHead[],
  })

  if (!parentValidation.ok) {
    return conflict(parentValidation.message)
  }

  const nextParentId =
    parsed.data.parentAccountHeadId === undefined ? currentHead.parent_id : parsed.data.parentAccountHeadId

  const { data: existingHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", client.id)
    .eq("sub_group_id", currentHead.sub_group_id ?? "")
    .eq("parent_id", nextParentId ?? null)
    .ilike("name", parsed.data.accountHeadName)
    .neq("id", accountHeadId)
    .maybeSingle()

  if (existingHead) {
    return conflict("An account head with this name already exists at the selected hierarchy level.")
  }

  const updateData: AccountHeadUpdate = {
    name: parsed.data.accountHeadName.trim(),
    opening_balance: parsed.data.openingBalance,
    balance_type: parsed.data.balanceType,
    is_active: parsed.data.is_active,
    parent_id: nextParentId ?? null,
  }

  const { data: updatedHead, error } = await supabase
    .from("account_heads")
    .update(updateData)
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, data: sanitizeAccountHead(updatedHead) })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string; accountHeadId: string }> }
) {
  const { clientId, accountHeadId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canWriteClientData(membership)) {
    return NextResponse.json(
      { error: "You do not have permission to delete account heads." },
      { status: 403 }
    )
  }

  const { data: accountHead } = await supabase
    .from("account_heads")
    .select("*")
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!accountHead) {
    return NextResponse.json({ error: "Account head not found." }, { status: 404 })
  }

  const { data: subgroupHeads, error: subgroupHeadError } = await supabase
    .from("account_heads")
    .select("*")
    .eq("client_id", client.id)
    .eq("sub_group_id", accountHead.sub_group_id ?? "")

  if (subgroupHeadError) {
    return NextResponse.json({ error: subgroupHeadError.message }, { status: 400 })
  }

  const [{ count: voucherUsageCount, error: voucherUsageError }, { count: mappingUsageCount, error: mappingUsageError }] =
    await Promise.all([
      supabase
        .from("voucher_entries")
        .select("id", { count: "exact", head: true })
        .eq("account_head_id", accountHead.id),
      supabase
        .from("payroll_account_mappings")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("account_head_id", accountHead.id),
    ])

  const usageError = voucherUsageError ?? mappingUsageError
  if (usageError) {
    return NextResponse.json({ error: usageError.message }, { status: 400 })
  }

  const deleteValidation = validateAccountHeadDeletion({
    headId: accountHead.id,
    heads: (subgroupHeads ?? []) as AccountHead[],
    voucherReferenceCount: voucherUsageCount ?? 0,
    payrollMappingCount: mappingUsageCount ?? 0,
  })

  if (!deleteValidation.ok) {
    return conflict(deleteValidation.message)
  }

  const { error: deleteError } = await supabase
    .from("account_heads")
    .delete()
    .eq("id", accountHead.id)
    .eq("client_id", client.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
