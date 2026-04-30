import type { OrganizationPlan, OrganizationMemberRole } from "@/lib/types"

export const ROLE_OPTIONS: Array<{ value: OrganizationMemberRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
]

export const INVITABLE_ROLES: Array<{ value: Exclude<OrganizationMemberRole, "owner">; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
]

export function getPlanMemberLimit(plan: OrganizationPlan | null | undefined): number | null {
  if (plan === "starter") return 3
  if (plan === "professional") return 10
  return null
}

export function getPlanClientLimit(plan: OrganizationPlan | null | undefined): number | null {
  if (plan === "starter") return 5
  if (plan === "professional") return 25
  return null
}

export function formatRole(role: OrganizationMemberRole): string {
  const match = ROLE_OPTIONS.find((option) => option.value === role)
  return match?.label ?? role
}

export function formatPlanName(plan: OrganizationPlan | null | undefined): string {
  if (!plan) return "Starter"
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
}
