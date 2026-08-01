import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Billing portal is not available for SSLCommerz monthly renewals. Use the Subscription tab to renew the package.",
    },
    { status: 409 }
  )
}
