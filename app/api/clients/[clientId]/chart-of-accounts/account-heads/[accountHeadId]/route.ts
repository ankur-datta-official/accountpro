import { NextResponse } from "next/server"
import { z } from "zod"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountHead, AccountHeadUpdate } from "@/lib/types"

const updateAccountHeadSchema = z.object({
  accountHeadName: z.string().trim().min(2, "Account head name is required."),
  openingBalance: z.coerce.number().default(0),
  balanceType: z.enum(["debit", "credit"]),
  is_active: z.boolean().default(true),
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
    .select("id, sub_group_id")
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!currentHead) {
    return NextResponse.json({ error: "Account head not found." }, { status: 404 })
  }

  const { data: existingHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", client.id)
    .eq("sub_group_id", currentHead.sub_group_id)
    .ilike("name", parsed.data.accountHeadName)
    .neq("id", accountHeadId)
    .maybeSingle()

  if (existingHead) {
    return NextResponse.json(
      { error: "An account head with this name already exists under the selected sub-group." },
      { status: 400 }
    )
  }

  const updateData: AccountHeadUpdate = {
    name: parsed.data.accountHeadName.trim(),
    opening_balance: parsed.data.openingBalance,
    balance_type: parsed.data.balanceType,
    is_active: parsed.data.is_active,
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
