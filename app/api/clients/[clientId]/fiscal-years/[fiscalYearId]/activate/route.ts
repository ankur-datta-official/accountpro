import { NextResponse } from "next/server"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; fiscalYearId: string }> }
) {
  const { clientId, fiscalYearId } = await params
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
      { error: "You do not have permission to manage fiscal years." },
      { status: 403 }
    )
  }

  await supabase.from("fiscal_years").update({ is_active: false }).eq("client_id", client.id)

  const { error } = await supabase
    .from("fiscal_years")
    .update({ is_active: true, is_closed: false })
    .eq("id", fiscalYearId)
    .eq("client_id", client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
