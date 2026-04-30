import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { getPlanMemberLimit } from "@/lib/team"

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  role: z.enum(["admin", "accountant", "viewer"]),
  message: z.string().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid invite data." }, { status: 400 })
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
    return NextResponse.json({ error: "Only owners and admins can invite members." }, { status: 403 })
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle()

  const { data: members } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("org_id", membership.org_id)

  const planLimit = getPlanMemberLimit(organization?.plan)
  const memberCount = members?.length ?? 0

  if (planLimit !== null && memberCount >= planLimit) {
    return NextResponse.json(
      { error: `Your ${organization?.plan ?? "starter"} plan allows up to ${planLimit} team members.` },
      { status: 402 }
    )
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const matchedAuthUser = existingUser.users.find((item) => item.email?.toLowerCase() === normalizedEmail)

  const { data: duplicateMembership } = matchedAuthUser?.id
    ? await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("user_id", matchedAuthUser.id)
        .limit(1)
        .maybeSingle()
    : await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("org_id", membership.org_id)
        .eq("invited_email", normalizedEmail)
        .is("user_id", null)
        .limit(1)
        .maybeSingle()

  if (duplicateMembership) {
    return NextResponse.json({ error: "This member has already been invited." }, { status: 409 })
  }

  const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: {
      org_name: organization?.name ?? "your organization",
      invited_role: parsed.data.role,
    },
  })

  if (invite.error) {
    return NextResponse.json({ error: invite.error.message }, { status: 400 })
  }

  const invitedUserId = invite.data.user?.id ?? matchedAuthUser?.id ?? null

  const { error: memberInsertError } = await supabaseAdmin.from("organization_members").insert({
    org_id: membership.org_id,
    user_id: invitedUserId,
    invited_email: normalizedEmail,
    invitation_message: parsed.data.message?.trim() || null,
    role: parsed.data.role,
    is_active: false,
    invited_by: user.id,
  })

  if (memberInsertError) {
    return NextResponse.json({ error: memberInsertError.message }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    message: `Invitation sent to ${normalizedEmail}`,
  })
}
