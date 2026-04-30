import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabase/admin"

const deleteSchema = z.object({
  confirmName: z.string().min(1),
})

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation name is required." }, { status: 400 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id || membership.role !== "owner") {
    return NextResponse.json({ error: "Only organization owner can perform this action." }, { status: 403 })
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle()

  if (!organization) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  }

  if (parsed.data.confirmName.trim() !== organization.name) {
    return NextResponse.json({ error: "Organization name does not match." }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
