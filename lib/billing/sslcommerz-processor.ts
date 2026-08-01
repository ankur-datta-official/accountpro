import { activatePaidPlan, markProviderEventProcessed, upsertBillingTransaction } from "@/lib/billing/service"
import { getBillingEnv } from "@/lib/billing/env"
import { validateSSLCommerzOrder, type SSLCommerzValidationResponse } from "@/lib/billing/sslcommerz"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { BillingTransaction, OrganizationPlan } from "@/lib/types"

function toIso(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function parseAmount(value: string | null | undefined) {
  const amount = Number(value ?? "")
  return Number.isFinite(amount) ? amount : 0
}

async function getTransactionByTranId(tranId: string) {
  const { data } = await supabaseAdmin
    .from("billing_transactions")
    .select("*")
    .eq("provider", "sslcommerz")
    .eq("tran_id", tranId)
    .maybeSingle()

  return (data ?? null) as BillingTransaction | null
}

export async function processSSLCommerzPayment(input: {
  payload: Record<string, unknown>
  eventType: "success" | "ipn"
}) {
  const tranId = typeof input.payload.tran_id === "string" ? input.payload.tran_id : null
  const valId = typeof input.payload.val_id === "string" ? input.payload.val_id : null

  if (!tranId || !valId) {
    throw new Error("Missing SSLCommerz transaction identifiers.")
  }

  const billingEnv = getBillingEnv()
  const transaction = await getTransactionByTranId(tranId)
  if (!transaction) {
    throw new Error("No local billing transaction found for this SSLCommerz payment.")
  }

  const dedupe = await markProviderEventProcessed({
    provider: "sslcommerz",
    eventId: `${input.eventType}:${valId}`,
    eventType: `sslcommerz.${input.eventType}`,
    payload: input.payload,
  })

  if (!dedupe.inserted) {
    return { alreadyProcessed: true as const, transaction }
  }

  const validation = await validateSSLCommerzOrder({
    mode: billingEnv.sslcommerzMode,
    storeId: billingEnv.sslcommerzStoreId,
    storePassword: billingEnv.sslcommerzStorePassword,
    valId,
  })

  const validationStatus = String(validation.status ?? "").toUpperCase()
  if (validationStatus !== "VALID" && validationStatus !== "VALIDATED") {
    await upsertBillingTransaction({
      orgId: transaction.org_id,
      provider: "sslcommerz",
      tranId,
      providerReferenceId: valId,
      plan: transaction.plan,
      amount: transaction.amount,
      currency: transaction.currency,
      status: validationStatus || "failed_validation",
      sessionKey: transaction.session_key,
      customerName: transaction.customer_name,
      customerEmail: transaction.customer_email,
      customerPhone: transaction.customer_phone,
      rawPayload: validation as Record<string, unknown>,
    })

    throw new Error(`SSLCommerz validation failed with status ${validationStatus || "UNKNOWN"}.`)
  }

  const plan = (validation.value_b as OrganizationPlan | undefined) ?? transaction.plan
  const orgId = (validation.value_a as string | undefined) ?? transaction.org_id
  const paidAt = toIso(validation.validated_on) ?? new Date().toISOString()
  const amount = parseAmount(validation.amount) || transaction.amount

  const activation = await activatePaidPlan({
    orgId,
    provider: "sslcommerz",
    providerReferenceId: tranId,
    plan,
    amount,
    currency: validation.currency ?? transaction.currency,
    paidAt,
    rawPayload: validation as Record<string, unknown>,
  })

  await upsertBillingTransaction({
    orgId,
    provider: "sslcommerz",
    tranId,
    providerReferenceId: valId,
    plan,
    amount,
    currency: validation.currency ?? transaction.currency,
    status: "validated",
    sessionKey: transaction.session_key,
    customerName: transaction.customer_name,
    customerEmail: transaction.customer_email,
    customerPhone: transaction.customer_phone,
    paidAt,
    periodStart: activation.periodStart,
    periodEnd: activation.periodEnd,
    rawPayload: validation as Record<string, unknown>,
  })

  return {
    alreadyProcessed: false as const,
    transaction,
    validation: validation as SSLCommerzValidationResponse,
    activation,
  }
}
