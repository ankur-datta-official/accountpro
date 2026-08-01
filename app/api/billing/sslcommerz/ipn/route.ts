import { NextResponse } from "next/server"

import { processSSLCommerzPayment } from "@/lib/billing/sslcommerz-processor"

export async function POST(request: Request) {
  const form = await request.formData()
  const payload = Object.fromEntries(form.entries()) as Record<string, unknown>

  try {
    const result = await processSSLCommerzPayment({
      payload,
      eventType: "ipn",
    })

    return NextResponse.json({ success: true, duplicate: result.alreadyProcessed })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process SSLCommerz IPN." },
      { status: 400 }
    )
  }
}
