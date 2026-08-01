import type { OrganizationPlan } from "@/lib/types"

import { getBillingPlanDefinition, getBillablePlans } from "@/lib/billing/plans"

export type BillingProviderMode = "sslcommerz"

export type BillingEnv = {
  provider: BillingProviderMode
  appUrl: string
  supportEmail: string | null
  sslcommerzStoreId: string
  sslcommerzStorePassword: string
  sslcommerzMode: "sandbox" | "live"
  planAmountsByBdt: Partial<Record<OrganizationPlan, number>>
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function requireHttpUrl(value: string | null, key: string) {
  if (!value) {
    throw new Error(`Missing ${key}.`)
  }

  const parsed = new URL(value)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${key} must be a valid http:// or https:// URL.`)
  }

  return parsed.toString().replace(/\/$/, "")
}

function readPlanAmount(env: Record<string, string | undefined>, plan: OrganizationPlan) {
  const configured = normalizeEnvValue(env[`BILLING_${plan.toUpperCase()}_AMOUNT_BDT`])
  if (!configured) {
    return getBillingPlanDefinition(plan).amountBdt
  }

  const amount = Number(configured)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`BILLING_${plan.toUpperCase()}_AMOUNT_BDT must be a positive number.`)
  }

  return amount
}

export function getBillingEnv(env: Record<string, string | undefined> = process.env): BillingEnv {
  const appUrl = requireHttpUrl(
    normalizeEnvValue(env.NEXT_PUBLIC_APP_URL) ?? normalizeEnvValue(env.APP_URL),
    "NEXT_PUBLIC_APP_URL"
  )
  const sslcommerzStoreId = normalizeEnvValue(env.SSLCOMMERZ_STORE_ID)
  const sslcommerzStorePassword = normalizeEnvValue(env.SSLCOMMERZ_STORE_PASSWORD)

  if (!sslcommerzStoreId) {
    throw new Error("Missing SSLCOMMERZ_STORE_ID.")
  }

  if (!sslcommerzStorePassword) {
    throw new Error("Missing SSLCOMMERZ_STORE_PASSWORD.")
  }

  const rawMode = normalizeEnvValue(env.SSLCOMMERZ_MODE) ?? "sandbox"
  if (rawMode !== "sandbox" && rawMode !== "live") {
    throw new Error("SSLCOMMERZ_MODE must be either sandbox or live.")
  }

  const planAmountsByBdt = Object.fromEntries(
    getBillablePlans()
      .filter((plan) => plan.isSelfServe)
      .map((plan) => [plan.id, readPlanAmount(env, plan.id)])
      .filter((entry) => entry[1] != null)
  ) as Partial<Record<OrganizationPlan, number>>

  return {
    provider: "sslcommerz",
    appUrl,
    supportEmail: normalizeEnvValue(env.BILLING_SUPPORT_EMAIL) ?? normalizeEnvValue(env.DKLEDGER_SUPPORT_EMAIL),
    sslcommerzStoreId,
    sslcommerzStorePassword,
    sslcommerzMode: rawMode,
    planAmountsByBdt,
  }
}
