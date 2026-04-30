import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabase/admin"

const roleSchema = z.object({
  role: z.enum(["admin", "accountant", "viewer"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: { memberId: string } }
) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = roleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid role." }, { status: 400 })
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { data: actorMembership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!actorMembership?.org_id || (actorMembership.role !== "owner" && actorMembership.role !== "admin")) {
    return NextResponse.json({ error: "Only owners and admins can change roles." }, { status: 403 })
  }

  const { data: targetMembership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("id", params.memberId)
    .eq("org_id", actorMembership.org_id)
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 })
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be changed." }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", params.memberId)
    .eq("org_id", actorMembership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
