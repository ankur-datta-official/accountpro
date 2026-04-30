import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { getPlanClientLimit, getPlanMemberLimit } from "@/lib/team"

export async function GET(request: Request) {
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

  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id) {
    return NextResponse.json({ error: "No active organization found." }, { status: 403 })
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle()

  if (!organization) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  }

  const { count: clientCount } = await supabaseAdmin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .eq("is_active", true)

  const { count: memberCount } = await supabaseAdmin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)

  const clientLimit = organization.max_clients ?? getPlanClientLimit(organization.plan)
  const memberLimit = getPlanMemberLimit(organization.plan)

  return NextResponse.json({
    organization,
    role: membership.role,
    usage: {
      clients: clientCount ?? 0,
      members: memberCount ?? 0,
      clientLimit,
      memberLimit,
    },
  })
}
