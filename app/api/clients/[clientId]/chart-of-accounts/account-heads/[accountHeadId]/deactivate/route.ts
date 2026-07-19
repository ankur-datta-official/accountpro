import { NextResponse } from "next/server"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { AccountHead } from "@/lib/types"

function createServiceRoleClient() {
  return supabaseAdmin
}

function sanitizeAccountHead(head: AccountHead): AccountHead {
  return {
    ...head,
    is_active: head.is_active ?? true,
  }
}

export async function POST(
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

  const { data: updatedHead, error } = await supabase
    .from("account_heads")
    .update({ is_active: false })
    .eq("id", accountHeadId)
    .eq("client_id", client.id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, data: sanitizeAccountHead(updatedHead) })
}
