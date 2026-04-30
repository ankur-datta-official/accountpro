"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { AuthFormHeader } from "@/components/layout/auth-form-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type InvitationState = {
  orgName: string
  roleLabel: string
  email: string
}

export default function AcceptInvitationPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [invitation, setInvitation] = useState<InvitationState | null>(null)

  useEffect(() => {
    const loadInvitation = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setLoading(false)
        toast.error("Please open this page using your invitation email link.")
        return
      }

      const response = await fetch("/api/team/invitation", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json().catch(() => ({ error: "Unable to read invitation." }))
      setLoading(false)

      if (!response.ok) {
        toast.error(result.error ?? "Unable to read invitation.")
        return
      }

      setInvitation(result)
      const metadataName = (session.user.user_metadata?.full_name as string | undefined) ?? ""
      if (metadataName) {
        setFullName(metadataName)
      }
    }

    void loadInvitation()
  }, [supabase.auth])

  const handleSubmit = async () => {
    if (!fullName.trim() || password.length < 8) {
      toast.error("Enter your name and a password of at least 8 characters.")
      return
    }

    setSubmitting(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setSubmitting(false)
      toast.error("Your session has expired. Please open the invitation link again.")
      return
    }

    const response = await fetch("/api/team/invitation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        password,
      }),
    })
    const result = await response.json().catch(() => ({ error: "Unable to accept invitation." }))
    setSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to accept invitation.")
      return
    }

    toast.success("Invitation accepted. Welcome to the organization.")
    router.replace("/")
    router.refresh()
  }

  return (
    <div>
      <AuthFormHeader
        title="Accept Invitation"
        description={
          invitation
            ? `You've been invited to join ${invitation.orgName} as ${invitation.roleLabel}.`
            : "Finalize your account to join your organization."
        }
      />

      {loading ? (
        <div className="flex h-24 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading invitation...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={invitation?.email ?? ""} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Set Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <Button type="button" className="h-11 w-full" disabled={submitting || !invitation} onClick={handleSubmit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Join Organization
          </Button>
        </div>
      )}
    </div>
  )
}
