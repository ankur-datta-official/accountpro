import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/types"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseClientConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const rawPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  const supabaseAnonKey =
    rawAnonKey && !rawAnonKey.startsWith("your_supabase_")
      ? rawAnonKey
      : rawPublishableKey && !rawPublishableKey.startsWith("your_supabase_")
        ? rawPublishableKey
        : null

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey }
}

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  const supabaseConfig = getSupabaseClientConfig()

  if (!supabaseConfig) {
    throw new Error(
      "Supabase credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    )
  }

  browserClient = createBrowserClient<Database>(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey
  )

  return browserClient
}
