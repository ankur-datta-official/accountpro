"use client"

import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import type { Organization, OrganizationMember } from "@/lib/types"

type OrgState = {
  loading: boolean
  membership: OrganizationMember | null
  organization: Organization | null
  role: OrganizationMember["role"] | null
}

export function useOrg(): OrgState {
  const [state, setState] = useState<OrgState>({
    loading: true,
    membership: null,
    organization: null,
    role: null,
  })

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setState({
          loading: false,
          membership: null,
          organization: null,
          role: null,
        })
        return
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      if (!membership?.org_id) {
        setState({
          loading: false,
          membership: membership ?? null,
          organization: null,
          role: membership?.role ?? null,
        })
        return
      }

      const { data: organization } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.org_id)
        .maybeSingle()

      setState({
        loading: false,
        membership: membership ?? null,
        organization: organization ?? null,
        role: membership?.role ?? null,
      })
    }

    void load()
  }, [])

  return state
}
