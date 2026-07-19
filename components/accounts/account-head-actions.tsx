"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function DeactivateAccountHeadButton({
  clientId,
  accountHeadId,
  disabled,
}: {
  clientId: string
  accountHeadId: string
  disabled: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const handleDeactivate = async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setLoading(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(
      `/api/clients/${clientId}/chart-of-accounts/account-heads/${accountHeadId}/deactivate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    )

    const result = await response.json().catch(() => ({ error: "Unable to deactivate account head." }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to deactivate account head.")
      return
    }

    toast.success("Account head archived.")
    await queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", clientId] })
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-1.5 whitespace-nowrap text-destructive hover:text-destructive"
      disabled={disabled || loading}
      onClick={handleDeactivate}
    >
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      Delete
    </Button>
  )
}
