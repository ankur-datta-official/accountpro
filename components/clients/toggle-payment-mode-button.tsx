"use client"

import { useState } from "react"
import { Power } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function TogglePaymentModeButton({
  clientId,
  paymentModeId,
  isActive,
}: {
  clientId: string
  paymentModeId: string
  isActive: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
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
      `/api/clients/${clientId}/payment-modes/${paymentModeId}/toggle`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    )

    const result = await response.json().catch(() => ({ error: "Unable to update payment mode." }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to update payment mode.")
      return
    }

    toast.success(isActive ? "Payment mode deactivated." : "Payment mode activated.")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-slate-600"
      disabled={loading}
      onClick={handleToggle}
    >
      <Power className="mr-1.5 h-3.5 w-3.5" />
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  )
}
