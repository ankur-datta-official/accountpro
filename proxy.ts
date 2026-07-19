import { createServerClient } from "@supabase/ssr/dist/module/createServerClient"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabaseEnv } from "@/lib/supabase/env"

const PUBLIC_AUTH_ROUTES = new Set(["/login", "/register"])
const PROTECTED_ROUTE_PREFIXES = ["/clients", "/team", "/settings"]

function isProtectedRoute(pathname: string) {
  if (pathname === "/") {
    return true
  }

  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseEnv = getSupabaseEnv()

  if (!supabaseEnv) {
    return response
  }

  const supabase = createServerClient(
    supabaseEnv.supabaseUrl,
    supabaseEnv.supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const { pathname } = request.nextUrl

  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (PUBLIC_AUTH_ROUTES.has(pathname) && user) {
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
