import { redirect } from "next/navigation"

import { AccountCenter } from "@/components/account/account-center"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function AccountPage() {
  const supabase = await createClient()
  const { organization, membership, user } = await getCurrentOrganizationContext()

  if (!user) {
    redirect("/login")
  }

  const orgId = membership?.org_id ?? null

  const [{ count: activeClientCount }, { count: teamMemberCount }] = await Promise.all([
    orgId
      ? supabase.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    orgId
      ? supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", orgId)
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <AccountCenter
      initialName={(user.user_metadata.full_name as string | undefined) || user.email || "DKLedger User"}
      initialEmail={user.email || ""}
      organizationName={organization?.name ?? "Your Organization"}
      organizationSlug={organization?.slug ?? null}
      role={membership?.role ?? "viewer"}
      activeClientCount={activeClientCount ?? 0}
      teamMemberCount={teamMemberCount ?? 0}
      lastSignInAt={user.last_sign_in_at ?? null}
    />
  )
}
