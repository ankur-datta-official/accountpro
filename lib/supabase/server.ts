import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"

import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireSupabasePublicEnv } from "@/lib/supabase/env"
import type { Organization, OrganizationMember } from "@/lib/types"
import type { Database } from "@/lib/types/database"

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const supabaseEnv = requireSupabasePublicEnv()

  return createServerClient<Database>(supabaseEnv.supabaseUrl, supabaseEnv.supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options })
        } catch {}
      },
    },
  })
}

type OrganizationContext = {
  membership: OrganizationMember | null
  organization: Organization | null
  user: User | null
}

export const getCurrentOrganizationContext = cache(async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const supabase = await createClient()

  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  if (!user) {
    return {
      membership: null,
      organization: null,
      user: null,
    }
  }

  let membership: OrganizationMember | null = null
  try {
    const { data } = await supabase
      .from("organization_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
    membership = data
  } catch {
    membership = null
  }

  if (!membership?.org_id) {
    return {
      membership: membership ?? null,
      organization: null,
      user,
    }
  }

  let organization: Organization | null = null
  try {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .maybeSingle()
    organization = data
  } catch {
    organization = null
  }

  return {
    membership,
    organization: organization ?? null,
    user,
  }
})
