import { redirect } from "next/navigation"

import { ClientForm } from "@/components/clients/client-form"
import { getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function NewClientPage() {
  const { canManageOrganization } = await getCurrentOrganizationContext()

  if (!canManageOrganization) {
    redirect("/clients")
  }

  return <ClientForm />
}
