import { createClient } from "@supabase/supabase-js"

import { requireSupabaseServerEnv, SupabaseConfigurationError } from "@/lib/supabase/env"
import type { Database } from "@/lib/types"

function assertServerOnlyAdminContext() {
  if (typeof window !== "undefined") {
    throw new SupabaseConfigurationError(
      "missing_service_role_key",
      "Supabase admin access is only available on the server."
    )
  }
}

export function createSupabaseAdminClient() {
  assertServerOnlyAdminContext()
  const supabaseEnv = requireSupabaseServerEnv()

  return createClient<Database>(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const supabaseAdmin: any = createSupabaseAdminClient()
