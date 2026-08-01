import crypto from "crypto"

const STRIPE_API_BASE = "https://api.stripe.com/v1"

type StripeFetchOptions = {
  method?: "GET" | "POST"
  secretKey: string
  body?: URLSearchParams
}

async function stripeFetch<T>(path: string, options: StripeFetchOptions): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: options.method ?? "POST",
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: options.body?.toString(),
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null

  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message ?? "Stripe request failed.")
  }

  return payload
}

export type StripeCustomer = {
  id: string
  email: string | null
}

export type StripeCheckoutSession = {
  id: string
  url: string | null
}

export type StripeBillingPortalSession = {
  url: string
}

export type StripeSubscription = {
  id: string
  customer: string | null
  status: string
  currency: string | null
  cancel_at_period_end: boolean
  current_period_start?: number | null
  current_period_end?: number | null
  start_date?: number | null
  canceled_at?: number | null
  items?: {
    data?: Array<{
      price?: {
        id?: string | null
        unit_amount?: number | null
        recurring?: {
          interval?: string | null
        } | null
      } | null
    }>
  }
  metadata?: Record<string, string | undefined> | null
}

export async function createStripeCustomer(input: {
  secretKey: string
  email?: string | null
  name?: string | null
  orgId: string
  organizationName: string
}) {
  const body = new URLSearchParams()
  body.set("name", input.organizationName)
  body.set("metadata[org_id]", input.orgId)
  if (input.email) body.set("email", input.email)
  if (input.name) body.set("metadata[requested_by]", input.name)

  return stripeFetch<StripeCustomer>("/customers", {
    secretKey: input.secretKey,
    body,
  })
}

export async function createStripeCheckoutSession(input: {
  secretKey: string
  customerId: string
  orgId: string
  planId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string | null
}) {
  const body = new URLSearchParams()
  body.set("mode", "subscription")
  body.set("customer", input.customerId)
  body.set("line_items[0][price]", input.priceId)
  body.set("line_items[0][quantity]", "1")
  body.set("allow_promotion_codes", "true")
  body.set("success_url", input.successUrl)
  body.set("cancel_url", input.cancelUrl)
  body.set("client_reference_id", input.orgId)
  body.set("metadata[org_id]", input.orgId)
  body.set("metadata[plan_id]", input.planId)
  body.set("subscription_data[metadata][org_id]", input.orgId)
  body.set("subscription_data[metadata][plan_id]", input.planId)
  if (input.customerEmail) {
    body.set("customer_update[email]", "auto")
  }

  return stripeFetch<StripeCheckoutSession>("/checkout/sessions", {
    secretKey: input.secretKey,
    body,
  })
}

export async function createStripeBillingPortalSession(input: {
  secretKey: string
  customerId: string
  returnUrl: string
}) {
  const body = new URLSearchParams()
  body.set("customer", input.customerId)
  body.set("return_url", input.returnUrl)

  return stripeFetch<StripeBillingPortalSession>("/billing_portal/sessions", {
    secretKey: input.secretKey,
    body,
  })
}

export async function getStripeSubscription(secretKey: string, subscriptionId: string) {
  return stripeFetch<StripeSubscription>(`/subscriptions/${subscriptionId}`, {
    secretKey,
    method: "GET",
  })
}

export function verifyStripeWebhookSignature(input: {
  payload: string
  signatureHeader: string | null
  webhookSecret: string
  toleranceSeconds?: number
}) {
  const header = input.signatureHeader
  if (!header) {
    throw new Error("Missing Stripe signature header.")
  }

  const parts = new Map(
    header
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter((entry): entry is [string, string] => entry.length === 2)
  )

  const timestamp = parts.get("t")
  const signatures = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe signature header.")
  }

  const expected = crypto
    .createHmac("sha256", input.webhookSecret)
    .update(`${timestamp}.${input.payload}`)
    .digest("hex")

  const isValid = signatures.some((signature) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  })

  if (!isValid) {
    throw new Error("Stripe webhook signature verification failed.")
  }

  const toleranceSeconds = input.toleranceSeconds ?? 300
  const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance.")
  }
}
