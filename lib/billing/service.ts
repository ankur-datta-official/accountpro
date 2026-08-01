import type { OrganizationPlan } from "@/lib/types"

import { getActiveMembership } from "@/lib/api-auth"
import { getBillingPlanDefinition } from "@/lib/billing/plans"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type {
  BillingCustomer,
  BillingProvider,
  BillingSubscription,
  BillingTransaction,
  Organization,
  OrganizationMember,
} from "@/lib/types"

export type BillingOverview = {
  customer: BillingCustomer | null
  subscription: BillingSubscription | null
  latestTransaction: BillingTransaction | null
}

function getPlanMaxClients(plan: OrganizationPlan) {
  if (plan === "starter") return 5
  if (plan === "professional") return 25
  return null
}

function nowIso() {
  return new Date().toISOString()
}

function addDays(startIso: string, days: number) {
  const date = new Date(startIso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function isExpired(isoValue: string | null | undefined) {
  if (!isoValue) return false
  return new Date(isoValue).getTime() < Date.now()
}

export async function reconcileOrganizationBilling(orgId: string) {
  const { data: subscription } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeSubscription = (subscription ?? null) as BillingSubscription | null
  if (!activeSubscription) {
    return null
  }

  const shouldDowngrade =
    activeSubscription.provider === "sslcommerz" &&
    ["active", "validated"].includes(activeSubscription.status) &&
    isExpired(activeSubscription.current_period_end)

  if (!shouldDowngrade) {
    return activeSubscription
  }

  const timestamp = nowIso()
  await Promise.all([
    supabaseAdmin
      .from("billing_subscriptions")
      .update({
        status: "expired",
        updated_at: timestamp,
      })
      .eq("id", activeSubscription.id),
    supabaseAdmin
      .from("organizations")
      .update({
        plan: "starter",
        max_clients: 5,
        updated_at: timestamp,
      })
      .eq("id", orgId),
  ])

  return {
    ...activeSubscription,
    status: "expired",
  } satisfies BillingSubscription
}

export async function getAuthorizedOrganizationForBilling(accessToken: string) {
  const { user, membership } = await getActiveMembership(accessToken)

  if (!user) {
    return { user: null, membership: null, organization: null }
  }

  if (!membership?.org_id || (membership.role !== "owner" && membership.role !== "admin")) {
    return { user, membership, organization: null }
  }

  await reconcileOrganizationBilling(membership.org_id)

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle()

  return {
    user,
    membership: membership as OrganizationMember,
    organization: (organization ?? null) as Organization | null,
  }
}

export async function getBillingOverview(orgId: string): Promise<BillingOverview> {
  const [{ data: customer }, { data: subscription }, { data: latestTransaction }] = await Promise.all([
    supabaseAdmin
      .from("billing_customers")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscriptions")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_transactions")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const normalizedSubscription = (await reconcileOrganizationBilling(orgId)) ?? ((subscription ?? null) as BillingSubscription | null)

  return {
    customer: (customer ?? null) as BillingCustomer | null,
    subscription: normalizedSubscription,
    latestTransaction: (latestTransaction ?? null) as BillingTransaction | null,
  }
}

export async function ensureBillingCustomer(input: {
  orgId: string
  provider: BillingProvider
  providerCustomerId: string
  email?: string | null
}) {
  const timestamp = nowIso()
  const { error } = await supabaseAdmin.from("billing_customers").upsert(
    {
      org_id: input.orgId,
      provider: input.provider,
      provider_customer_id: input.providerCustomerId,
      email: input.email ?? null,
      updated_at: timestamp,
    },
    {
      onConflict: "org_id,provider",
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function upsertBillingTransaction(input: {
  orgId: string
  provider: BillingProvider
  tranId: string
  providerReferenceId?: string | null
  plan: OrganizationPlan
  amount: number
  currency: string
  status: string
  sessionKey?: string | null
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  paidAt?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  rawPayload?: Record<string, unknown>
}) {
  const timestamp = nowIso()
  const { error } = await supabaseAdmin.from("billing_transactions").upsert(
    {
      org_id: input.orgId,
      provider: input.provider,
      tran_id: input.tranId,
      provider_reference_id: input.providerReferenceId ?? null,
      plan: input.plan,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      session_key: input.sessionKey ?? null,
      customer_name: input.customerName ?? null,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      paid_at: input.paidAt ?? null,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      raw_payload: input.rawPayload ?? {},
      updated_at: timestamp,
    },
    {
      onConflict: "provider,tran_id",
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function activatePaidPlan(input: {
  orgId: string
  provider: BillingProvider
  providerReferenceId: string
  plan: OrganizationPlan
  amount: number
  currency: string
  paidAt?: string | null
  rawPayload?: Record<string, unknown>
}) {
  const planDefinition = getBillingPlanDefinition(input.plan)
  const periodStart = input.paidAt ?? nowIso()
  const periodEnd = addDays(periodStart, planDefinition.renewalDays)
  const timestamp = nowIso()

  const { error } = await supabaseAdmin.from("billing_subscriptions").upsert(
    {
      org_id: input.orgId,
      provider: input.provider,
      provider_customer_id: null,
      provider_subscription_id: input.providerReferenceId,
      provider_price_id: null,
      plan: input.plan,
      status: "active",
      currency: input.currency,
      amount_minor: Math.round(input.amount * 100),
      interval: "monthly_manual",
      cancel_at_period_end: false,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      started_at: periodStart,
      cancelled_at: null,
      metadata: {},
      raw_payload: input.rawPayload ?? {},
      updated_at: timestamp,
    },
    {
      onConflict: "org_id,provider",
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  const { error: orgError } = await supabaseAdmin
    .from("organizations")
    .update({
      plan: input.plan,
      max_clients: getPlanMaxClients(input.plan),
      updated_at: timestamp,
    })
    .eq("id", input.orgId)

  if (orgError) {
    throw new Error(orgError.message)
  }

  return { periodStart, periodEnd }
}

export async function markProviderEventProcessed(input: {
  provider: BillingProvider
  eventId: string
  eventType: string
  payload: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin.from("billing_webhook_events").insert({
    provider: input.provider,
    provider_event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
  })

  if (!error) {
    return { inserted: true as const }
  }

  if (error.code === "23505") {
    return { inserted: false as const }
  }

  throw new Error(error.message)
}
