import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/"
  }

  return next
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = getSafeNextPath(url.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(new URL("/forgot-password?error=missing_code", url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/forgot-password?error=invalid_or_expired", url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
