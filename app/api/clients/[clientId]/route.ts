import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import type { Database } from "@/lib/types"

const updateClientSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["company", "individual", "partnership", "ngo"]),
  tin: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  fiscal_year_start: z.number().int().min(1).max(12),
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

export async function PATCH(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = updateClientSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid client data." }, { status: 400 })
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

  const { error } = await serviceClient
    .from("clients")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      tin: parsed.data.tin || null,
      bin: parsed.data.bin || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      fiscal_year_start: parsed.data.fiscal_year_start,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.clientId)
    .eq("org_id", membership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
