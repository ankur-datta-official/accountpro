"use client"

import { useParams } from "next/navigation"

import { useAppQuery } from "@/lib/query"
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

  const query = useAppQuery({
    queryKey: ["client", clientId],
    enabled: Boolean(clientId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Client | null> => {
      if (!clientId) {
        return null
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return null
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      // Try with org_id first
      if (membership?.org_id) {
        const { data: clientByOrg } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .eq("org_id", membership.org_id)
          .maybeSingle()

        if (clientByOrg) {
          return clientByOrg
        }
      }

      // Fallback to just client_id
      const { data: clientById } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle()

      return clientById ?? null
    },
  })

  return {
    client: query.data ?? null,
    clientId,
    hasAccess: Boolean(query.data),
    loading: query.isLoading,
  }
}
