import type { Client, OrganizationMember, OrganizationMemberRole } from "./types"

import { extractClientIdFromRouteSegment, isUuid, matchesClientRouteSegment } from "./routing/clients"
import { supabaseAdmin } from "./supabase/admin"

function createServiceRoleClient() {
  return supabaseAdmin
}

export async function getAuthorizedClient(
  accessToken: string,
  clientId: string,
  supabase = createServiceRoleClient()
) {
  const normalizedClientId = extractClientIdFromRouteSegment(clientId)
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return { user: null, membership: null, client: null }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!membership?.org_id) {
    return {
      user,
      membership: null,
      client: null,
    }
  }

  const client = isUuid(normalizedClientId)
    ? (
        await supabase
          .from("clients")
          .select("*")
          .eq("id", normalizedClientId)
          .eq("org_id", membership.org_id)
          .maybeSingle()
      ).data
    : (
        await supabase.from("clients").select("*").eq("org_id", membership.org_id)
      ).data?.find((candidate: Client) => matchesClientRouteSegment(candidate, clientId)) ?? null

  return { user, membership, client: (client ?? null) as Client | null }
}

export function hasClientRole(
  membership: Pick<OrganizationMember, "role"> | null | undefined,
  allowedRoles: readonly OrganizationMemberRole[]
) {
  if (!membership?.role) {
    return false
  }

  return allowedRoles.includes(membership.role)
}

export function canManageClient(
  membership: Pick<OrganizationMember, "role"> | null | undefined
) {
  return hasClientRole(membership, ["owner", "admin"])
}

export function canWriteClientData(
  membership: Pick<OrganizationMember, "role"> | null | undefined
) {
  return hasClientRole(membership, ["owner", "admin", "accountant"])
}

export async function getActiveMembership(
  accessToken: string,
  supabase = createServiceRoleClient()
) {
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken)

  if (!user) {
    return { user: null, membership: null }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  return {
    user,
    membership: (membership ?? null) as OrganizationMember | null,
  }
}
