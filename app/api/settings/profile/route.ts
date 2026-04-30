import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabase/admin"

const profileSchema = z.object({
  name: z.string().min(2, "Organization name is required."),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")).nullable(),
  logo_url: z.string().url().optional().or(z.literal("")).nullable(),
})

export async function PATCH(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = profileSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile data." }, { status: 400 })
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

  if (!membership?.org_id || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Only owners and admins can update organization profile." }, { status: 403 })
  }

  const payload = parsed.data
  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      name: payload.name.trim(),
      address: payload.address?.trim() || null,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      logo_url: payload.logo_url?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
