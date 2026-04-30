import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { formatRole } from "@/lib/team"

const completeSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const accessToken = authHeader.replace("Bearer ", "")
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (error || !user) return null
  return { user, accessToken }
}

export async function GET(request: Request) {
  const context = await getUserFromRequest(request)
  if (!context?.user.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const normalizedEmail = context.user.email.toLowerCase()

  const { data: pendingMembership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("invited_email", normalizedEmail)
    .eq("is_active", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pendingMembership?.org_id) {
    return NextResponse.json({ error: "No pending invitation found." }, { status: 404 })
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", pendingMembership.org_id)
    .maybeSingle()

  return NextResponse.json({
    orgName: organization?.name ?? "Organization",
    role: pendingMembership.role,
    roleLabel: formatRole(pendingMembership.role),
    email: normalizedEmail,
  })
}

export async function POST(request: Request) {
  const context = await getUserFromRequest(request)
  if (!context?.user.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = completeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form data." }, { status: 400 })
  }

  const normalizedEmail = context.user.email.toLowerCase()

  const { data: pendingMembership } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("invited_email", normalizedEmail)
    .eq("is_active", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pendingMembership?.org_id) {
    return NextResponse.json({ error: "No pending invitation found." }, { status: 404 })
  }

  const { error: userUpdateError } = await supabaseAdmin.auth.admin.updateUserById(context.user.id, {
    password: parsed.data.password,
    user_metadata: {
      ...(context.user.user_metadata ?? {}),
      full_name: parsed.data.fullName.trim(),
    },
    email_confirm: true,
  })

  if (userUpdateError) {
    return NextResponse.json({ error: userUpdateError.message }, { status: 400 })
  }

  const { error: activateError } = await supabaseAdmin
    .from("organization_members")
    .update({
      user_id: context.user.id,
      is_active: true,
    })
    .eq("id", pendingMembership.id)

  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
