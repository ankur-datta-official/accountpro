"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"

type RegisterUserResult =
  | { success: true; requiresEmailConfirmation: boolean }
  | { success: false; error: string }

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function generateUniqueSlug(organizationName: string) {
  const baseSlug = slugify(organizationName) || "accountpro-org"

  for (let index = 0; index < 5; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
    const { data } = await supabaseAdmin.from("organizations").select("id").eq("slug", candidate).maybeSingle()

    if (!data) {
      return candidate
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
}

export async function registerUser(
  name: string,
  orgName: string,
  email: string,
  password: string
): Promise<RegisterUserResult> {
  const normalizedName = name.trim()
  const normalizedOrgName = orgName.trim()
  const normalizedEmail = email.trim().toLowerCase()

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: normalizedName,
    },
  })

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      error: createUserError?.message ?? "Unable to create your account.",
    }
  }

  const slug = await generateUniqueSlug(normalizedOrgName)
  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: normalizedOrgName,
      slug,
    })
    .select("id")
    .single()

  if (organizationError || !organization) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)
    return {
      success: false,
      error: organizationError?.message ?? "Unable to create organization.",
    }
  }

  const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
    org_id: organization.id,
    user_id: createdUser.user.id,
    role: "owner",
    is_active: true,
  })

  if (memberError) {
    await supabaseAdmin.from("organizations").delete().eq("id", organization.id)
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)
    return {
      success: false,
      error: memberError.message ?? "Unable to assign organization membership.",
    }
  }

  return {
    success: true,
    requiresEmailConfirmation: true,
  }
}

type EnsureMembershipParams = {
  userId: string
  email?: string | null
  fullName?: string | null
}

export async function ensureActiveMembershipForUser({
  userId,
  email,
  fullName,
}: EnsureMembershipParams) {
  const { data: activeMembership } = await supabaseAdmin
    .from("organization_members")
    .select("org_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (activeMembership?.org_id) {
    return activeMembership.org_id
  }

  const { data: anyMembership } = await supabaseAdmin
    .from("organization_members")
    .select("org_id, is_active")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (anyMembership?.org_id) {
    if (!anyMembership.is_active) {
      await supabaseAdmin
        .from("organization_members")
        .update({ is_active: true })
        .eq("user_id", userId)
        .eq("org_id", anyMembership.org_id)
    }

    return anyMembership.org_id
  }

  const orgBaseName =
    (fullName && fullName.trim()) || (email ? email.split("@")[0] : null) || "AccountPro Organization"
  const slug = await generateUniqueSlug(orgBaseName)

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: orgBaseName,
      slug,
    })
    .select("id")
    .single()

  if (organizationError || !organization) {
    throw new Error(organizationError?.message ?? "Unable to auto-create organization.")
  }

  const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
    org_id: organization.id,
    user_id: userId,
    role: "owner",
    is_active: true,
  })

  if (memberError) {
    await supabaseAdmin.from("organizations").delete().eq("id", organization.id)
    throw new Error(memberError.message ?? "Unable to auto-create membership.")
  }

  return organization.id
}
