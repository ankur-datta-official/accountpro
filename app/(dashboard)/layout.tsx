import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { organization, user } = await getCurrentOrganizationContext()

  if (!user) {
    redirect("/login")
  }

  const userName = user.user_metadata.full_name || user.email || "AccountPro User"

  return (
    <DashboardShell orgName={organization?.name ?? "Your Organization"} userName={userName}>
      {children}
    </DashboardShell>
  )
}
