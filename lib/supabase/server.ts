import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { User } from "@supabase/supabase-js"

import type { Database, Organization, OrganizationMember } from "@/lib/types"

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )
}

type OrganizationContext = {
  membership: OrganizationMember | null
  organization: Organization | null
  user: User | null
}

export async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      membership: null,
      organization: null,
      user: null,
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
      user,
    }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle()

  return {
    membership,
    organization: organization ?? null,
    user,
  }
}
