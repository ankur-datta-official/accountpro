import { redirect } from "next/navigation"

import { TeamManagement } from "@/components/team/TeamManagement"
import { getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function TeamPage() {
  const { canManageOrganization } = await getCurrentOrganizationContext()

  if (!canManageOrganization) {
    redirect("/clients")
  }

  return <TeamManagement />
}
