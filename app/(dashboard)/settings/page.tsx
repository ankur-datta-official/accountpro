"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PlanLimitBanner } from "@/components/settings/PlanLimitBanner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { formatPlanName } from "@/lib/team"
import type { Organization, OrganizationMemberRole, OrganizationPlan } from "@/lib/types"
import { cn } from "@/lib/utils"

type SettingsOverview = {
  organization: Organization
  role: OrganizationMemberRole
  usage: {
    clients: number
    members: number
    clientLimit: number | null
    memberLimit: number | null
  }
}

const tabItems = [
  { id: "profile", label: "Organization Profile" },
  { id: "subscription", label: "Subscription Plan" },
  { id: "security", label: "Account Security" },
  { id: "danger", label: "Danger Zone" },
] as const

type TabId = (typeof tabItems)[number]["id"]

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [deletingOrganization, setDeletingOrganization] = useState(false)
  const [overview, setOverview] = useState<SettingsOverview | null>(null)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [logoUrl, setLogoUrl] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [confirmOrgName, setConfirmOrgName] = useState("")

  const loadOverview = async () => {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setLoading(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch("/api/settings/overview", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const result = await response.json().catch(() => ({ error: "Unable to load settings." }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to load settings.")
      return
    }

    setOverview(result)
    setName(result.organization.name ?? "")
    setAddress(result.organization.address ?? "")
    setPhone(result.organization.phone ?? "")
    setEmail(result.organization.email ?? "")
    setLogoUrl(result.organization.logo_url ?? "")
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  const handleProfileSave = async () => {
    if (!overview) return
    setSavingProfile(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setSavingProfile(false)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const response = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name,
        address,
        phone,
        email,
        logo_url: logoUrl,
      }),
    })
    const result = await response.json().catch(() => ({ error: "Unable to save organization profile." }))
    setSavingProfile(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save organization profile.")
      return
    }

    toast.success("Organization profile updated.")
    await loadOverview()
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setUploadingLogo(false)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/settings/logo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    })
    const result = await response.json().catch(() => ({ error: "Logo upload failed." }))
    setUploadingLogo(false)

    if (!response.ok) {
      toast.error(result.error ?? "Logo upload failed.")
      return
    }

    setLogoUrl(result.logoUrl)
    toast.success("Logo uploaded.")
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
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) {
      setUpdatingPassword(false)
      toast.error("Unable to verify current account.")
      return
    }

    const verify = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })

    if (verify.error) {
      setUpdatingPassword(false)
      toast.error("Current password is incorrect.")
      return
    }

    const updated = await supabase.auth.updateUser({
      password: newPassword,
    })

    setUpdatingPassword(false)

    if (updated.error) {
      toast.error(updated.error.message)
      return
    }

    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    toast.success("Password updated.")
  }

  const handleOrganizationDelete = async () => {
    if (!overview) return
    setDeletingOrganization(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setDeletingOrganization(false)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const response = await fetch("/api/settings/delete-organization", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ confirmName: confirmOrgName }),
    })
    const result = await response.json().catch(() => ({ error: "Unable to delete organization." }))
    setDeletingOrganization(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to delete organization.")
      return
    }

    toast.success("Organization deactivated.")
    router.replace("/")
    router.refresh()
  }

  const planCards = useMemo(
    () => [
      {
        id: "starter" as OrganizationPlan,
        title: "STARTER",
        price: "৳0/month",
        features: ["5 clients", "3 team members", "Basic reports", "Email support"],
      },
      {
        id: "professional" as OrganizationPlan,
        title: "PROFESSIONAL",
        price: "৳999/month",
        features: ["25 clients", "10 members", "All reports", "Excel export", "Priority email"],
      },
      {
        id: "enterprise" as OrganizationPlan,
        title: "ENTERPRISE",
        price: "Custom",
        features: ["Unlimited clients", "Unlimited members", "Priority support", "Custom onboarding"],
      },
    ],
    []
  )

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-16 shadow-sm">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PlanLimitBanner clientsUsed={overview.usage.clients} clientLimit={overview.usage.clientLimit} />

      <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Organization Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage profile, subscription, security, and organization-level controls.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabItems.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      {activeTab === "profile" ? (
        <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={`accountpro.app/${overview.organization.slug}`} disabled />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {logoUrl ? <img src={logoUrl} alt="Organization logo" className="h-full w-full object-cover" /> : null}
              </div>
              <Input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleLogoUpload(file)
                  }
                }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input id="org-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input id="org-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="org-address">Address</Label>
            <Textarea id="org-address" rows={4} value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="button" disabled={savingProfile} onClick={handleProfileSave}>
              {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === "subscription" ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {planCards.map((plan) => {
              const isCurrent = overview.organization.plan === plan.id
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "rounded-2xl border bg-white p-5 shadow-sm",
                    isCurrent ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                  )}
                >
                  <p className="text-xs font-semibold tracking-wide text-slate-500">{plan.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{plan.price}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {plan.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {isCurrent ? (
                      <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">Current Plan</Badge>
                    ) : (
                      <Button type="button" variant="outline" className="w-full">
                        Upgrade
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Current usage ({formatPlanName(overview.organization.plan)} plan)
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {overview.usage.clients}/{overview.usage.clientLimit ?? "∞"} clients used
            </p>
            <p className="text-sm text-slate-600">
              {overview.usage.members}/{overview.usage.memberLimit ?? "∞"} members used
            </p>
          </Card>
        </div>
      ) : null}

      {activeTab === "security" ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Change password</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" disabled={updatingPassword} onClick={handlePasswordChange}>
                {updatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Active sessions</h2>
            <p className="mt-2 text-sm text-slate-500">
              Session management UI will be available in a future update.
            </p>
          </Card>
        </div>
      ) : null}

      {activeTab === "danger" ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
          <p className="mt-2 text-sm text-red-800">
            Deactivate this organization. This action is limited to owners.
          </p>

          <div className="mt-4 space-y-2">
            <Label htmlFor="confirm-org-name">Type organization name to confirm</Label>
            <Input
              id="confirm-org-name"
              value={confirmOrgName}
              onChange={(event) => setConfirmOrgName(event.target.value)}
              placeholder={overview.organization.name}
              className={cn(overview.role !== "owner" ? "cursor-not-allowed opacity-60" : "")}
              disabled={overview.role !== "owner"}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              variant="destructive"
              disabled={
                overview.role !== "owner" ||
                confirmOrgName.trim() !== overview.organization.name ||
                deletingOrganization
              }
              onClick={handleOrganizationDelete}
            >
              {deletingOrganization ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Organization
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
