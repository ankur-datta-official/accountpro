import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import type { Database } from "@/lib/types"

function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function POST(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const serviceClient = createServiceRoleClient()

  const {
    data: { user },
    error: userError,
  } = await serviceClient.auth.getUser(accessToken)

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await serviceClient
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { data: clientRecord } = await serviceClient
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .eq("org_id", membership.org_id)
    .maybeSingle()

  if (!clientRecord) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const { error } = await serviceClient
    .from("clients")
    .update({ is_active: false })
    .eq("id", params.clientId)
    .eq("org_id", membership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
