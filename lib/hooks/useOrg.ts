"use client"

import { useAppQuery } from "@/lib/query"
import { createClient } from "@/lib/supabase/client"
import type { Organization, OrganizationMember } from "@/lib/types"

type OrgState = {
  loading: boolean
  membership: OrganizationMember | null
  organization: Organization | null
  role: OrganizationMember["role"] | null
}

export function useOrg(): OrgState {
  const query = useAppQuery({
    queryKey: ["organization-context"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Omit<OrgState, "loading">> => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return {
          membership: null,
          organization: null,
          role: null,
        }
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
          membership: membership ?? null,
          organization: null,
          role: membership?.role ?? null,
        }
      }

      const { data: organization } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.org_id)
        .maybeSingle()

      return {
        membership: membership ?? null,
        organization: organization ?? null,
        role: membership?.role ?? null,
      }
    },
  })

  return {
    loading: query.isLoading,
    membership: query.data?.membership ?? null,
    organization: query.data?.organization ?? null,
    role: query.data?.role ?? null,
  }
}
