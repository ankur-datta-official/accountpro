import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { getPlanMemberLimit } from "@/lib/team"

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

  const { data: members, error: membersError } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: true })

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 400 })
  }

  const userIds = (members ?? []).map((item) => item.user_id).filter((value): value is string => Boolean(value))
  const uniqueUserIds = Array.from(new Set(userIds))

  const userMap = new Map<string, { email: string | null; fullName: string | null }>()

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
      userMap.set(userId, {
        email: data.user?.email ?? null,
        fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? null,
      })
    })
  )

  const rows = (members ?? []).map((member) => {
    const profile = member.user_id ? userMap.get(member.user_id) : null
    const email = member.invited_email ?? profile?.email ?? null
    const fullName = profile?.fullName
    const status = member.is_active ? "active" : member.user_id ? "inactive" : "pending"
    return {
      id: member.id,
      userId: member.user_id,
      role: member.role,
      isActive: Boolean(member.is_active),
      status,
      invitedEmail: member.invited_email,
      invitationMessage: member.invitation_message,
      email,
      fullName,
      createdAt: member.created_at,
    }
  })

  const totalMembers = rows.length
  const activeMembers = rows.filter((item) => item.status === "active").length
  const pendingInvitations = rows.filter((item) => item.status === "pending").length
  const planLimit = getPlanMemberLimit(organization?.plan)

  return NextResponse.json({
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          plan: organization.plan,
        }
      : null,
    currentUserId: user.id,
    currentUserRole: membership.role,
    canManageRoles: membership.role === "owner" || membership.role === "admin",
    stats: {
      totalMembers,
      activeMembers,
      pendingInvitations,
    },
    limits: {
      plan: organization?.plan ?? "starter",
      limit: planLimit,
      isAtLimit: planLimit !== null && totalMembers >= planLimit,
    },
    members: rows,
  })
}
