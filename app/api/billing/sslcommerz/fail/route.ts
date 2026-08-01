import { NextResponse } from "next/server"

import { getBillingEnv } from "@/lib/billing/env"

function buildRedirectUrl(baseUrl: string, state: "failed" | "cancelled") {
  const url = new URL("/settings", baseUrl)
  url.searchParams.set("tab", "subscription")
  url.searchParams.set("billing", state)
  return url
}

export async function POST() {
  const billingEnv = getBillingEnv()
  return NextResponse.redirect(buildRedirectUrl(billingEnv.appUrl, "failed"), { status: 303 })
}
