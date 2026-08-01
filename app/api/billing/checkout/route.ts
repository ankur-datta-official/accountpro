import crypto from "crypto"

import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthorizedOrganizationForBilling, getBillingOverview, upsertBillingTransaction } from "@/lib/billing/service"
import { getBillingEnv } from "@/lib/billing/env"
import { createSSLCommerzSession } from "@/lib/billing/sslcommerz"
import type { OrganizationPlan } from "@/lib/types"

const checkoutSchema = z.object({
  plan: z.enum(["professional", "enterprise"]),
})

function buildCallbackUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString()
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan selection." }, { status: 400 })
  }

  const requestedPlan = parsed.data.plan as OrganizationPlan
  if (requestedPlan === "enterprise") {
    return NextResponse.json(
      { error: "Enterprise is configured for custom sales follow-up, not self-serve checkout." },
      { status: 400 }
    )
  }

  const accessToken = authHeader.replace("Bearer ", "")
  const { user, membership, organization } = await getAuthorizedOrganizationForBilling(accessToken)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!membership?.org_id || !organization) {
    return NextResponse.json({ error: "Only owners and admins can manage billing." }, { status: 403 })
  }

  let billingEnv: ReturnType<typeof getBillingEnv>
  try {
    billingEnv = getBillingEnv()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing is not configured yet." },
      { status: 503 }
    )
  }

  const amount = billingEnv.planAmountsByBdt[requestedPlan]
  if (!amount) {
    return NextResponse.json(
      { error: `Billing is not configured for the ${requestedPlan} plan yet.` },
      { status: 503 }
    )
  }

  const overview = await getBillingOverview(organization.id)
  if (
    overview.subscription?.provider === "sslcommerz" &&
    overview.subscription?.status === "active" &&
    overview.subscription.plan === requestedPlan &&
    overview.subscription.current_period_end &&
    new Date(overview.subscription.current_period_end).getTime() > Date.now()
  ) {
    return NextResponse.json(
      { error: `Your ${requestedPlan} package is already active until ${overview.subscription.current_period_end}.` },
      { status: 409 }
    )
  }

  const tranId = `ACCPRO-${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`

  const sessionPayload = {
    total_amount: amount.toFixed(2),
    currency: "BDT",
    tran_id: tranId,
    product_category: "software_subscription",
    success_url: buildCallbackUrl(billingEnv.appUrl, "/api/billing/sslcommerz/success"),
    fail_url: buildCallbackUrl(billingEnv.appUrl, "/api/billing/sslcommerz/fail"),
    cancel_url: buildCallbackUrl(billingEnv.appUrl, "/api/billing/sslcommerz/cancel"),
    ipn_url: buildCallbackUrl(billingEnv.appUrl, "/api/billing/sslcommerz/ipn"),
    cus_name: organization.name,
    cus_email: user.email ?? organization.email ?? "billing@dkledger.com",
    cus_add1: organization.address ?? "Dhaka",
    cus_add2: organization.address ?? "Dhaka",
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: organization.phone ?? "01700000000",
    ship_name: organization.name,
    ship_add1: organization.address ?? "Dhaka",
    ship_add2: organization.address ?? "Dhaka",
    ship_city: "Dhaka",
    ship_state: "Dhaka",
    ship_postcode: "1000",
    ship_country: "Bangladesh",
    multi_card_name: "bkash,nagad,rocket,visacard,mastercard",
    value_a: organization.id,
    value_b: requestedPlan,
    value_c: membership.user_id ?? user.id,
    value_d: "accountpro",
  }

  const session = await createSSLCommerzSession({
    mode: billingEnv.sslcommerzMode,
    storeId: billingEnv.sslcommerzStoreId,
    storePassword: billingEnv.sslcommerzStorePassword,
    payload: sessionPayload,
  })

  const paymentUrl =
    (typeof session.GatewayPageURL === "string" && session.GatewayPageURL) ||
    (typeof session.redirectGatewayURL === "string" && session.redirectGatewayURL) ||
    (typeof session.directPaymentURL === "string" && session.directPaymentURL) ||
    null

  if (!paymentUrl) {
    return NextResponse.json(
      { error: typeof session.failedreason === "string" ? session.failedreason : "Unable to create SSLCommerz session." },
      { status: 502 }
    )
  }

  await upsertBillingTransaction({
    orgId: organization.id,
    provider: "sslcommerz",
    tranId,
    providerReferenceId: null,
    plan: requestedPlan,
    amount,
    currency: "BDT",
    status: "initiated",
    sessionKey: typeof session.sessionkey === "string" ? session.sessionkey : null,
    customerName: organization.name,
    customerEmail: user.email ?? organization.email,
    customerPhone: organization.phone,
    rawPayload: session as Record<string, unknown>,
  })

  return NextResponse.json({ url: paymentUrl })
}
