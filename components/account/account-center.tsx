"use client"

import Link from "next/link"
import { useState } from "react"
import { Building2, CheckCircle2, Loader2, LogOut, Mail, ShieldCheck, UserCircle2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { formatRole } from "@/lib/team"
import type { OrganizationMemberRole } from "@/lib/types"

type AccountCenterProps = {
  initialName: string
  initialEmail: string
  organizationName: string
  organizationSlug: string | null
  role: OrganizationMemberRole
  activeClientCount: number
  teamMemberCount: number
  lastSignInAt: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available"

  try {
    return new Intl.DateTimeFormat("en-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function AccountCenter({
  initialName,
  initialEmail,
  organizationName,
  organizationSlug,
  role,
  activeClientCount,
  teamMemberCount,
  lastSignInAt,
}: AccountCenterProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialName)
  const [savingProfile, setSavingProfile] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleProfileSave = async () => {
    const trimmedName = displayName.trim()
    if (trimmedName.length < 2) {
      toast.error("Full name must be at least 2 characters.")
      return
    }

    setSavingProfile(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: trimmedName,
      },
    })
    setSavingProfile(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success("Your account profile has been updated.")
    router.refresh()
  }

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Confirm password does not match.")
      return
    }

    setUpdatingPassword(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) {
      setUpdatingPassword(false)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const updated = await supabase.auth.updateUser({
      current_password: currentPassword,
      password: newPassword,
    })
    setUpdatingPassword(false)

    if (updated.error) {
      toast.error(
        /password/i.test(updated.error.message)
          ? updated.error.message
          : "Unable to update your password right now."
      )
      return
    }

    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    toast.success("Your password has been updated.")
  }

  const handleLogout = async () => {
    setSigningOut(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)

    if (error) {
      toast.error(error.message)
      return
    }

    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_35%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_100%)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Account Center</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{displayName}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Manage your sign-in identity, password, workspace access, and the most common account actions from one place.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{formatRole(role)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Organizations</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">1 active workspace</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last sign in</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(lastSignInAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-950">Quick actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link href="/settings">Organization settings</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link href="/team">Team access</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
                  <Link href="/clients">Switch organization</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{organizationName}</p>
                    <p className="text-xs text-slate-500">{organizationSlug ? `dkledger.com/${organizationSlug}` : "Active workspace"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Session status</p>
                    <p className="text-xs text-slate-500">Signed in and ready to work</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-sm font-semibold text-slate-950">Access snapshot</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Team members</span>
                </div>
                <span className="text-sm font-semibold text-slate-950">{teamMemberCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Active clients</span>
                </div>
                <span className="text-sm font-semibold text-slate-950">{activeClientCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Access level</span>
                </div>
                <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                  {formatRole(role)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Profile</h2>
              <p className="mt-1 text-sm text-slate-500">Keep your personal identity clear across the workspace.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="account-full-name">Full name</Label>
              <Input
                id="account-full-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your full name"
                className="h-11 rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="account-email"
                  value={initialEmail}
                  readOnly
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-9 text-slate-600"
                />
              </div>
              <p className="text-xs text-slate-500">Email changes are currently managed through your authentication provider.</p>
            </div>

            <div className="flex justify-end">
              <Button type="button" className="rounded-full" disabled={savingProfile} onClick={handleProfileSave}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save profile
              </Button>
            </div>
          </div>
        </Card>

        <Card id="security" className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Security</h2>
              <p className="mt-1 text-sm text-slate-500">Protect your login with a stronger password and clear session actions.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-950">Current session</p>
              <p className="mt-1 text-sm text-slate-500">
                Active at {organizationName}. Last sign-in recorded on {formatDateTime(lastSignInAt)}.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="rounded-full border-slate-200" onClick={() => void handleLogout()} disabled={signingOut}>
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Sign out
              </Button>
              <Button type="button" className="rounded-full" disabled={updatingPassword} onClick={handlePasswordChange}>
                {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
