import { NextResponse } from "next/server"

import { processSSLCommerzPayment } from "@/lib/billing/sslcommerz-processor"
import { getBillingEnv } from "@/lib/billing/env"

function buildRedirectUrl(baseUrl: string, state: "success" | "failed") {
  const url = new URL("/settings", baseUrl)
  url.searchParams.set("tab", "subscription")
  url.searchParams.set("billing", state)
  return url
}

export async function POST(request: Request) {
  const form = await request.formData()
  const payload = Object.fromEntries(form.entries()) as Record<string, unknown>

  try {
    const billingEnv = getBillingEnv()
    await processSSLCommerzPayment({
      payload,
      eventType: "success",
    })

    return NextResponse.redirect(buildRedirectUrl(billingEnv.appUrl, "success"), { status: 303 })
  } catch {
    const billingEnv = getBillingEnv()
    return NextResponse.redirect(buildRedirectUrl(billingEnv.appUrl, "failed"), { status: 303 })
  }
}
