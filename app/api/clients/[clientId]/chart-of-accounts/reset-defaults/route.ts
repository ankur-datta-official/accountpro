import { NextResponse } from "next/server"

import { createDefaultChartOfAccounts } from "@/lib/accounting/defaults"
import { canManageClient, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const serviceClient = createServiceRoleClient()
  const { user, membership, client } = await getAuthorizedClient(accessToken, clientId, serviceClient)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  if (!canManageClient(membership)) {
    return NextResponse.json(
      { error: "Only owners and admins can reset default accounts." },
      { status: 403 }
    )
  }

  try {
    await createDefaultChartOfAccounts(client.id, serviceClient)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset default accounts." },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
