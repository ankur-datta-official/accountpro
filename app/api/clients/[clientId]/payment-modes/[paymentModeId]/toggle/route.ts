import { NextResponse } from "next/server"

import { canWriteClientData, getAuthorizedClient } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; paymentModeId: string }> }
) {
  const { clientId, paymentModeId } = await params
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
      { error: "You do not have permission to manage payment modes." },
      { status: 403 }
    )
  }

  const { data: paymentMode } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("id", paymentModeId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!paymentMode) {
    return NextResponse.json({ error: "Payment mode not found." }, { status: 404 })
  }

  const { error } = await supabase
    .from("payment_modes")
    .update({ is_active: !paymentMode.is_active })
    .eq("id", paymentMode.id)
    .eq("client_id", client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
