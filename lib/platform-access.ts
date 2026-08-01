import type { User } from "@supabase/supabase-js"

import type { OrganizationMember } from "@/lib/types"

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

export function getPlatformAdminEmails(env: Record<string, string | undefined> = process.env) {
  const raw = env.DKLEDGER_PLATFORM_ADMIN_EMAILS ?? ""

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    )
  )
}

export function isPlatformAdminEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  return getPlatformAdminEmails(env).includes(normalizedEmail)
}

export function isPlatformAdminUser(
  user: Pick<User, "email"> | null | undefined,
  env: Record<string, string | undefined> = process.env
) {
  return isPlatformAdminEmail(user?.email, env)
}

export function canManageOrganization(
  membership: Pick<OrganizationMember, "role"> | null | undefined
) {
  return membership?.role === "owner" || membership?.role === "admin"
}

export function canAccessManagementPanel(
  user: Pick<User, "email"> | null | undefined
) {
  return isPlatformAdminUser(user)
}
