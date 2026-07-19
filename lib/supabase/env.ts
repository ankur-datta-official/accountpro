export type SupabasePublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

export type SupabaseServerEnv = SupabasePublicEnv & {
  supabaseServiceRoleKey: string
}

type EnvMode = "development" | "production" | "test"

type EnvSource = Record<string, string | undefined>

type EnvValidationCode =
  | "missing_public_url"
  | "missing_public_anon_key"
  | "invalid_public_url"
  | "missing_service_role_key"

export class SupabaseConfigurationError extends Error {
  code: EnvValidationCode
  safeMessage: string

  constructor(code: EnvValidationCode, safeMessage: string) {
    super(safeMessage)
    this.name = "SupabaseConfigurationError"
    this.code = code
    this.safeMessage = safeMessage
  }
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

function getModeFromEnv(env: EnvSource): EnvMode {
  const mode = env.NODE_ENV
  if (mode === "production" || mode === "test") {
    return mode
  }

  return "development"
}

function readServerOnlyEnvValue(env: EnvSource, key: "SUPABASE_SERVICE_ROLE_KEY") {
  if (typeof window !== "undefined") {
    return null
  }

  return normalizeEnvValue(env[key])
}

export function evaluateSupabaseEnv(env: EnvSource = process.env) {
  const mode = getModeFromEnv(env)
  const supabaseUrl = normalizeEnvValue(env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey =
    normalizeEnvValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    normalizeEnvValue(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const supabaseServiceRoleKey = readServerOnlyEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY")

  let publicError: SupabaseConfigurationError | null = null
  if (!supabaseUrl) {
    publicError = new SupabaseConfigurationError(
      "missing_public_url",
      "Supabase authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL."
    )
  } else if (!supabaseAnonKey) {
    publicError = new SupabaseConfigurationError(
      "missing_public_anon_key",
      "Supabase authentication is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    )
  } else if (!isValidHttpUrl(supabaseUrl)) {
    publicError = new SupabaseConfigurationError(
      "invalid_public_url",
      "Supabase authentication is not configured correctly. NEXT_PUBLIC_SUPABASE_URL must be a full http:// or https:// URL."
    )
  }

  const serverError =
    publicError ??
    (supabaseServiceRoleKey
      ? null
      : new SupabaseConfigurationError(
          "missing_service_role_key",
          "Supabase server configuration is incomplete. Add SUPABASE_SERVICE_ROLE_KEY."
        ))

  return {
    mode,
    public: publicError
      ? null
      : ({
          supabaseUrl: supabaseUrl!,
          supabaseAnonKey: supabaseAnonKey!,
        } satisfies SupabasePublicEnv),
    server:
      serverError === null
        ? ({
            supabaseUrl: supabaseUrl!,
            supabaseAnonKey: supabaseAnonKey!,
            supabaseServiceRoleKey: supabaseServiceRoleKey!,
          } satisfies SupabaseServerEnv)
        : null,
    publicError,
    serverError,
  }
}

export function getSupabasePublicEnv(env: EnvSource = process.env) {
  return evaluateSupabaseEnv(env).public
}

export function requireSupabasePublicEnv(env: EnvSource = process.env) {
  const result = evaluateSupabaseEnv(env)
  if (!result.public || result.publicError) {
    throw result.publicError ?? new SupabaseConfigurationError("missing_public_url", "Supabase authentication is not configured.")
  }

  return result.public
}

export function getSupabaseServerEnv(env: EnvSource = process.env) {
  return evaluateSupabaseEnv(env).server
}

export function requireSupabaseServerEnv(env: EnvSource = process.env) {
  const result = evaluateSupabaseEnv(env)
  if (!result.server || result.serverError) {
    throw result.serverError ?? new SupabaseConfigurationError("missing_service_role_key", "Supabase server configuration is incomplete.")
  }

  return result.server
}

export function getSupabaseConfigError(env: EnvSource = process.env) {
  return evaluateSupabaseEnv(env).publicError?.safeMessage ?? null
}

export function isSupabaseProductionFailClosed(env: EnvSource = process.env) {
  return evaluateSupabaseEnv(env).mode === "production"
}
