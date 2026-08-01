import type { OrganizationPlan } from "@/lib/types"

export type BillingPlanDefinition = {
  id: OrganizationPlan
  title: string
  priceLabel: string
  amountBdt: number | null
  description: string
  features: string[]
  renewalDays: number
  isFree: boolean
  isSelfServe: boolean
}

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: "starter",
    title: "STARTER",
    priceLabel: "৳0/month",
    amountBdt: null,
    description: "For getting started with a small finance team.",
    features: ["5 clients", "3 team members", "Basic reports", "Email support"],
    renewalDays: 0,
    isFree: true,
    isSelfServe: false,
  },
  {
    id: "professional",
    title: "PROFESSIONAL",
    priceLabel: "৳999/month",
    amountBdt: 999,
    description: "Best for growing firms that need more clients and team seats.",
    features: ["25 clients", "10 members", "All reports", "Excel export", "Priority email"],
    renewalDays: 30,
    isFree: false,
    isSelfServe: true,
  },
  {
    id: "enterprise",
    title: "ENTERPRISE",
    priceLabel: "Custom",
    amountBdt: null,
    description: "For larger operations that need custom limits and onboarding.",
    features: ["Unlimited clients", "Unlimited members", "Priority support", "Custom onboarding"],
    renewalDays: 30,
    isFree: false,
    isSelfServe: false,
  },
]

export function getBillingPlanDefinition(plan: OrganizationPlan) {
  return BILLING_PLANS.find((item) => item.id === plan) ?? BILLING_PLANS[0]
}

export function getBillablePlans() {
  return BILLING_PLANS.filter((plan) => !plan.isFree)
}
