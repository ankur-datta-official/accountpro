import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(
  request: Request,
  { params }: { params: { memberId: string } }
) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
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
    return NextResponse.json({ error: "Only owners and admins can deactivate members." }, { status: 403 })
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
    return NextResponse.json({ error: "Owner cannot be deactivated." }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({ is_active: false })
    .eq("id", params.memberId)
    .eq("org_id", actorMembership.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
