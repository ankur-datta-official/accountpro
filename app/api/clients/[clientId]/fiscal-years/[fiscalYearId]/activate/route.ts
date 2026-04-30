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
  { params }: { params: { clientId: string; fiscalYearId: string } }
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const supabase = createServiceRoleClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  await supabase.from("fiscal_years").update({ is_active: false }).eq("client_id", client.id)

  const { error } = await supabase
    .from("fiscal_years")
    .update({ is_active: true, is_closed: false })
    .eq("id", params.fiscalYearId)
    .eq("client_id", client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
