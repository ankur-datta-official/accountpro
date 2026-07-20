import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { buildClientRouteSegment } from "@/lib/routing/clients"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { OrganizationMemberRole } from "@/lib/types"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { organization, membership, user } = await getCurrentOrganizationContext()

  if (!user) {
    redirect("/login")
  }

  const { data: clients } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("id,name,type,trade_name")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
    : { data: [] }

  const userName = user.user_metadata.full_name || user.email || "DKLedger User"
  const userEmail = user.email || ""
  const userRole: OrganizationMemberRole = membership?.role ?? "viewer"

  return (
    <DashboardShell
      orgName={organization?.name ?? "Your Organization"}
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      clients={(clients ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        type: client.type,
        routeSegment: buildClientRouteSegment(client),
      }))}
    >
      {children}
    </DashboardShell>
  )
}
