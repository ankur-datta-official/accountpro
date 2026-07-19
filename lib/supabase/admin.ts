import { createClient } from "@supabase/supabase-js"

import { getSupabaseEnv } from "@/lib/supabase/env"
import type { Database } from "@/lib/types"

type MockResult<T = null> = Promise<{ data: T; error: { message: string } | null }>

function resolved<T>(data: T): Promise<{ data: T; error: null }> {
  return Promise.resolve({ data, error: null })
}

function rejected(message: string): MockResult {
  return Promise.resolve({ data: null, error: { message } })
}

function createMockQueryBuilder() {
  const builder: any = {}

  const chainMethods = ["select", "eq", "neq", "order", "limit", "range", "in", "ilike", "gte", "lte", "match", "filter", "or", "insert", "update", "upsert", "delete", "rpc"]
  for (const method of chainMethods) {
    builder[method] = () => builder
  }

  builder.maybeSingle = () => resolved(null)
  builder.single = () => resolved(null)
  builder.then = undefined

  return builder
}

function createMockStorageBucket() {
  return {
    upload: () => rejected("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local."),
    remove: () => rejected("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local."),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
    list: () => resolved([]),
  }
}

function createMockAdminClient(): any {
  return {
    auth: {
      getUser: () => resolved({ user: null }),
      admin: {
        createUser: () => rejected("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."),
        deleteUser: () => resolved(null),
        updateUserById: () => rejected("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."),
        getUserById: () => resolved({ user: null }),
        listUsers: () => resolved({ users: [] }),
        inviteUserByEmail: () => rejected("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."),
      },
    },
    storage: {
      from: () => createMockStorageBucket(),
    },
    from: () => createMockQueryBuilder(),
  }
}

const supabaseEnv = getSupabaseEnv()

export const supabaseAdmin: any = supabaseEnv && supabaseEnv.supabaseServiceRoleKey
  ? createClient<Database>(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMockAdminClient()
