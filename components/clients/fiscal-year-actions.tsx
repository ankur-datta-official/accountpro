"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

async function withSessionToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

export function SetActiveFiscalYearButton({
  clientId,
  fiscalYearId,
  disabled,
}: {
  clientId: string
  fiscalYearId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const token = await withSessionToken()

    if (!token) {
      setLoading(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/fiscal-years/${fiscalYearId}/activate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json().catch(() => ({ error: "Unable to update fiscal year." }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to update fiscal year.")
      return
    }

    toast.success("Fiscal year set as active.")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-xl border-slate-200"
      disabled={disabled || loading}
      onClick={handleClick}
    >
      <CheckCircle2 className="mr-2 h-4 w-4" />
      Set as Active
    </Button>
  )
}

export function CloseFiscalYearButton({
  clientId,
  fiscalYearId,
  disabled,
}: {
  clientId: string
  fiscalYearId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCloseYear = async () => {
    setLoading(true)
    const token = await withSessionToken()

    if (!token) {
      setLoading(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/fiscal-years/${fiscalYearId}/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json().catch(() => ({ error: "Unable to close fiscal year." }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to close fiscal year.")
      return
    }

    toast.success("Fiscal year closed.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="rounded-xl border-slate-200" disabled={disabled}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Close Year
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-slate-200">
        <DialogHeader>
          <DialogTitle>Close this fiscal year?</DialogTitle>
          <DialogDescription>
            Closing a fiscal year marks it as locked for day-to-day activity. You can still view it later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" className="rounded-xl border-slate-200" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={loading} onClick={handleCloseYear}>
            {loading ? "Closing..." : "Confirm Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
