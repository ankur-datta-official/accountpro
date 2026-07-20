import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  evaluateSupabaseEnv,
  type SupabasePublicEnv,
} from "@/lib/supabase/env"

const GUEST_ONLY_AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
])
const PROTECTED_ROUTE_PREFIXES = ["/clients", "/team", "/settings", "/account"]
const CONFIGURATION_ERROR_HEADER = "x-accountpro-auth-config-error"

function isProtectedRoute(pathname: string) {
  if (pathname === "/") {
    return true
  }

  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isGuestOnlyAuthRoute(pathname: string) {
  return GUEST_ONLY_AUTH_ROUTES.has(pathname)
}

function isApiRoute(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/")
}

export function getProxyDecision(input: {
  pathname: string
  hasValidPublicAuthConfig: boolean
  isAuthenticated: boolean
}) {
  const { pathname, hasValidPublicAuthConfig, isAuthenticated } = input
  const isGuestOnly = isGuestOnlyAuthRoute(pathname)
  const isProtected = isProtectedRoute(pathname)

  if (!hasValidPublicAuthConfig) {
    if (isProtected) {
      return {
        action: "fail_closed" as const,
      }
    }

    return {
      action: "allow" as const,
    }
  }

  if (isProtected && !isAuthenticated) {
    return {
      action: "redirect_login" as const,
    }
  }

  if (isGuestOnly && isAuthenticated) {
    return {
      action: "redirect_home" as const,
    }
  }

  return {
    action: "allow" as const,
  }
}

function createConfigurationErrorResponse(request: NextRequest, message: string) {
  if (isApiRoute(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: "Authentication is unavailable because server configuration is incomplete." },
      {
        status: 503,
        headers: {
          [CONFIGURATION_ERROR_HEADER]: "1",
        },
      }
    )
  }

  return new NextResponse(message, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      [CONFIGURATION_ERROR_HEADER]: "1",
    },
  })
}

function createConfiguredSupabaseClient(
  request: NextRequest,
  response: NextResponse,
  supabaseEnv: SupabasePublicEnv
) {
  return createServerClient(supabaseEnv.supabaseUrl, supabaseEnv.supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        request.cookies.set({ name, value, ...options })
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        request.cookies.set({ name, value: "", ...options })
        response.cookies.set({ name, value: "", ...options })
      },
    },
  })
}

export async function proxy(request: NextRequest) {
  const envResult = evaluateSupabaseEnv()
  const { pathname } = request.nextUrl

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const preliminaryDecision = getProxyDecision({
    pathname,
    hasValidPublicAuthConfig: Boolean(envResult.public),
    isAuthenticated: false,
  })

  if (preliminaryDecision.action === "fail_closed") {
    const safeMessage =
      envResult.publicError?.safeMessage ??
      "Authentication is unavailable because server configuration is incomplete."
    return createConfigurationErrorResponse(request, safeMessage)
  }

  if (!envResult.public) {
    return response
  }

  const supabase = createConfiguredSupabaseClient(request, response, envResult.public)

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const decision = getProxyDecision({
    pathname,
    hasValidPublicAuthConfig: true,
    isAuthenticated: Boolean(user),
  })

  if (decision.action === "redirect_login") {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (decision.action === "redirect_home") {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = "/"
    dashboardUrl.search = ""
    return NextResponse.redirect(dashboardUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
