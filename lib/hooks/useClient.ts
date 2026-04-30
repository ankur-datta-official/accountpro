"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"
import type { Client } from "@/lib/types"

type UseClientState = {
  client: Client | null
  clientId: string | null
  hasAccess: boolean
  loading: boolean
}

export function useClient(): UseClientState {
  const params = useParams<{ clientId: string }>()
  const clientId = typeof params?.clientId === "string" ? params.clientId : null
  const [state, setState] = useState<UseClientState>({
    client: null,
    clientId,
    hasAccess: false,
    loading: true,
  })

  useEffect(() => {
    if (!clientId) {
      setState({
        client: null,
        clientId: null,
        hasAccess: false,
        loading: false,
      })
      return
    }

    const supabase = createClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setState({
          client: null,
          clientId,
          hasAccess: false,
          loading: false,
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
          client: null,
          clientId,
          hasAccess: false,
          loading: false,
        })
        return
      }

      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()

      setState({
        client: client ?? null,
        clientId,
        hasAccess: Boolean(client),
        loading: false,
      })
    }

    void load()
  }, [clientId])

  return state
}
