type SupabaseEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey?: string
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith("your_supabase_") || trimmed === "your_password") {
    return null
  }

  return trimmed
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey =
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const supabaseServiceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!isValidHttpUrl(supabaseUrl)) {
    return null
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: supabaseServiceRoleKey ?? undefined,
  }
}

export function getSupabaseConfigError() {
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey =
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  if (!supabaseUrl || !supabaseAnonKey) {
    return "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in .env.local."
  }

  if (!isValidHttpUrl(supabaseUrl)) {
    return "Invalid NEXT_PUBLIC_SUPABASE_URL. Use a full http:// or https:// Supabase project URL."
  }

  return null
}
