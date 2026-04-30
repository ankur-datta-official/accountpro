import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import type { Database } from "@/lib/types"

const paymentModeSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["bank", "cash", "mobile_banking", "other"]),
  account_no: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

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

async function getAuthorizedClient(
  accessToken: string,
  clientId: string,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return { user: null, client: null }
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
        .eq("id", clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

  return { user, client }
}

export async function PATCH(
  request: Request,
  { params }: { params: { clientId: string; paymentModeId: string } }
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const body = await request.json().catch(() => null)
  const parsed = paymentModeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payment mode data." },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { user, client } = await getAuthorizedClient(accessToken, params.clientId, supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  const { error } = await supabase
    .from("payment_modes")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      account_no: parsed.data.account_no || null,
      is_active: parsed.data.is_active,
    })
    .eq("id", params.paymentModeId)
    .eq("client_id", client.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
