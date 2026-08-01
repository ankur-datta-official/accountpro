import Link from "next/link"
import { redirect } from "next/navigation"
import type { ComponentType } from "react"
import { Database, HardDrive, ReceiptText, ShieldCheck, TimerReset, Users } from "lucide-react"

import { LandingPage } from "@/components/marketing/landing-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-shell"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildClientPath, buildClientRouteSegment } from "@/lib/routing/clients"
import { evaluateSupabaseEnv } from "@/lib/supabase/env"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"
import type { Client, OrganizationMember } from "@/lib/types"

type AdminMemberRow = Pick<
  OrganizationMember,
  "id" | "org_id" | "user_id" | "role" | "is_active" | "invited_email" | "created_at"
>

type AdminClientRow = Pick<Client, "id" | "org_id" | "name" | "trade_name" | "is_active">

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  is_active: boolean | null
  created_at: string | null
}

type VoucherAttachmentRow = {
  uploaded_by: string | null
  client_id: string
  file_size: number
}

type VoucherRow = {
  created_by: string | null
  client_id: string | null
  created_at: string | null
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const numberFormatter = new Intl.NumberFormat("en-US")

function formatDate(value?: string | null) {
  if (!value) return "Not available"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not available"

  return dateFormatter.format(date)
}

function formatPlanLabel(plan?: string | null) {
  if (!plan) return "Starter"
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

function formatStorage(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="rounded-full border-0 bg-[var(--success-bg)] text-[var(--success-fg)] hover:bg-[var(--success-bg)]">
      Active
    </Badge>
  ) : (
    <Badge variant="secondary" className="rounded-full border-0 bg-[var(--surface-subtle)] text-[var(--text-muted)]">
      Pending
    </Badge>
  )
}

function PlanBadge({ plan }: { plan?: string | null }) {
  const label = formatPlanLabel(plan)
  const className =
    plan === "enterprise"
      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
      : plan === "professional"
        ? "bg-[var(--info-bg)] text-[var(--info-fg)]"
        : "bg-[var(--accent-soft)] text-[var(--accent)]"

  return <Badge className={`rounded-full border-0 ${className}`}>{label}</Badge>
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string
  value: string
  detail: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card className="rounded-2xl border-[var(--border-default)] bg-white">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-subtle)] text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const envResult = evaluateSupabaseEnv()

  if (!envResult.public) {
    return <LandingPage />
  }

  const { membership, user, isPlatformAdmin } = await getCurrentOrganizationContext()

  if (!user) {
    return <LandingPage />
  }

  const userName = user.user_metadata.full_name || user.email || "DKLedger User"

  if (!membership?.org_id) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Access pending"
          title="Your account is ready"
          description="This sign-in is active, but workspace access has not been assigned yet. A DKLedger admin can invite or activate you from the management panel."
          icon={ShieldCheck}
        />

        <Card className="rounded-xl border-[var(--border-default)] bg-white">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-[var(--text-secondary)]">
              Signed in as <span className="font-medium text-[var(--text-primary)]">{userName}</span>.
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              If you already received an invitation, open the invitation link again and complete the join flow.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: orgClients } = await supabase
    .from("clients")
    .select("id,name,type,trade_name,is_active")
    .eq("org_id", membership.org_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (!isPlatformAdmin) {
    const defaultClient = (orgClients ?? [])[0]
    if (defaultClient) {
      redirect(
        buildClientPath({
          id: defaultClient.id,
          name: defaultClient.name,
          trade_name: defaultClient.trade_name,
          routeSegment: buildClientRouteSegment(defaultClient),
        })
      )
    }

    redirect("/clients")
  }

  const [{ data: organizations }, { data: members }, { data: clients }, { data: attachments }, { data: vouchers }] =
    await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("id,name,slug,plan,is_active,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("organization_members")
        .select("id,org_id,user_id,role,is_active,invited_email,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("clients").select("id,org_id,name,trade_name,is_active"),
      supabaseAdmin.from("voucher_attachments").select("uploaded_by,client_id,file_size"),
      supabaseAdmin.from("vouchers").select("created_by,client_id,created_at").order("created_at", { ascending: false }),
    ])

  const organizationRows = (organizations ?? []) as OrganizationRow[]
  const memberRows = (members ?? []) as AdminMemberRow[]
  const clientRows = (clients ?? []) as AdminClientRow[]
  const attachmentRows = (attachments ?? []) as VoucherAttachmentRow[]
  const voucherRows = (vouchers ?? []) as VoucherRow[]

  const organizationMap = new Map(organizationRows.map((organization) => [organization.id, organization]))
  const clientMap = new Map(clientRows.map((client) => [client.id, client]))
  const orgClientCountMap = new Map<string, number>()
  const orgMemberCountMap = new Map<string, number>()
  const orgStorageBytesMap = new Map<string, number>()
  const userStorageBytesMap = new Map<string, number>()
  const userLastActivityMap = new Map<string, string>()

  for (const client of clientRows) {
    if (!client.org_id) continue
    orgClientCountMap.set(client.org_id, (orgClientCountMap.get(client.org_id) ?? 0) + (client.is_active === false ? 0 : 1))
  }

  for (const member of memberRows) {
    if (!member.org_id) continue
    orgMemberCountMap.set(member.org_id, (orgMemberCountMap.get(member.org_id) ?? 0) + (member.is_active === false ? 0 : 1))
  }

  for (const attachment of attachmentRows) {
    const client = clientMap.get(attachment.client_id)
    if (client?.org_id) {
      orgStorageBytesMap.set(client.org_id, (orgStorageBytesMap.get(client.org_id) ?? 0) + Number(attachment.file_size ?? 0))
    }

    if (attachment.uploaded_by) {
      userStorageBytesMap.set(
        attachment.uploaded_by,
        (userStorageBytesMap.get(attachment.uploaded_by) ?? 0) + Number(attachment.file_size ?? 0)
      )
    }
  }

  for (const voucher of voucherRows) {
    if (!voucher.created_by || !voucher.created_at || userLastActivityMap.has(voucher.created_by)) continue
    userLastActivityMap.set(voucher.created_by, voucher.created_at)
  }

  const uniqueUserIds = Array.from(new Set(memberRows.map((member) => member.user_id).filter(Boolean))) as string[]
  const userProfileMap = new Map<string, { email: string | null; fullName: string | null }>()

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
      userProfileMap.set(userId, {
        email: data.user?.email ?? null,
        fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? null,
      })
    })
  )

  const userAccessRows = memberRows.map((member) => {
    const organization = member.org_id ? organizationMap.get(member.org_id) : null
    const profile = member.user_id ? userProfileMap.get(member.user_id) : null
    const email = member.invited_email ?? profile?.email ?? null
    const fullName = profile?.fullName ?? email?.split("@")[0] ?? "Pending user"
    const storageBytes = member.user_id ? userStorageBytesMap.get(member.user_id) ?? 0 : 0
    const lastActivity = member.user_id ? userLastActivityMap.get(member.user_id) ?? null : null

    return {
      id: member.id,
      fullName,
      email: email ?? "Not available",
      organizationName: organization?.name ?? "Not assigned",
      packageName: organization?.plan ?? "starter",
      role: member.role,
      statusActive: Boolean(member.is_active && member.user_id),
      joinedAt: member.created_at,
      storageBytes,
      lastActivity,
      usageTimeLabel: "Not tracked yet",
    }
  })

  const billingRows = organizationRows.map((organization) => ({
    id: organization.id,
    organizationName: organization.name,
    plan: organization.plan,
    activeUsers: orgMemberCountMap.get(organization.id) ?? 0,
    activeClients: orgClientCountMap.get(organization.id) ?? 0,
    storageBytes: orgStorageBytesMap.get(organization.id) ?? 0,
    paymentMethod: "Not tracked yet",
    subscriptionDeadline: "Not tracked yet",
    statusActive: organization.is_active !== false,
  }))

  const totalTrackedUsers = new Set(userAccessRows.filter((row) => row.statusActive).map((row) => row.email)).size
  const pendingInvitations = userAccessRows.filter((row) => !row.statusActive).length
  const totalTrackedStorage = Array.from(orgStorageBytesMap.values()).reduce((sum, value) => sum + value, 0)
  const paidPlans = billingRows.filter((row) => row.plan === "professional" || row.plan === "enterprise").length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin panel"
        title="User and Subscription Control"
        description="Clean control view for users, package usage, storage usage, billing-related status, and subscription follow-up."
        icon={ShieldCheck}
        actions={
          <>
            <Button asChild className="rounded-xl">
              <Link href="/team">User Management</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-[var(--border-default)] bg-white">
              <Link href="/settings">Settings</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          title="Total Active Users"
          value={numberFormatter.format(totalTrackedUsers)}
          detail="Users with active access in the current platform records."
          icon={Users}
        />
        <SummaryCard
          title="Pending Invitations"
          value={numberFormatter.format(pendingInvitations)}
          detail="Invited accounts waiting to complete activation."
          icon={ShieldCheck}
        />
        <SummaryCard
          title="Tracked Storage Used"
          value={formatStorage(totalTrackedStorage)}
          detail="Calculated from uploaded voucher attachment files only."
          icon={HardDrive}
        />
        <SummaryCard
          title="Paid Packages"
          value={numberFormatter.format(paidPlans)}
          detail="Organizations currently on Professional or Enterprise plans."
          icon={ReceiptText}
        />
      </section>

      <Card className="rounded-3xl border-[var(--border-default)] bg-white">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-5">
          <CardTitle className="text-2xl text-[var(--text-primary)]">User access register</CardTitle>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Each row shows user detail, package association, tracked storage usage, and latest recorded activity.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-subtle)]">
                  <TableHead className="pl-6">User</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Storage Used</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Usage Time</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAccessRows.map((row) => (
                  <TableRow key={row.id} className="border-[var(--border-subtle)]">
                    <TableCell className="pl-6 align-top">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{row.fullName}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{row.email}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          Joined {formatDate(row.joinedAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{row.organizationName}</TableCell>
                    <TableCell>
                      <PlanBadge plan={row.packageName} />
                    </TableCell>
                    <TableCell className="capitalize text-[var(--text-secondary)]">{row.role}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{formatStorage(row.storageBytes)}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {row.lastActivity ? formatDate(row.lastActivity) : "Not tracked yet"}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{row.usageTimeLabel}</TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge active={row.statusActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-[var(--border-default)] bg-white">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-5">
          <CardTitle className="text-2xl text-[var(--text-primary)]">Subscription and billing register</CardTitle>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Package, storage, active usage footprint, payment field coverage, and renewal follow-up in one place.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border-subtle)]">
                  <TableHead className="pl-6">Organization</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Active Users</TableHead>
                  <TableHead>Active Clients</TableHead>
                  <TableHead>Storage Used</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Subscription Deadline</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingRows.map((row) => (
                  <TableRow key={row.id} className="border-[var(--border-subtle)]">
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{row.organizationName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          {numberFormatter.format(row.activeUsers)} users / {numberFormatter.format(row.activeClients)} clients
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={row.plan} />
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{numberFormatter.format(row.activeUsers)}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{numberFormatter.format(row.activeClients)}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{formatStorage(row.storageBytes)}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{row.paymentMethod}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{row.subscriptionDeadline}</TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge active={row.statusActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-[var(--border-default)] bg-white">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-5">
          <CardTitle className="text-xl text-[var(--text-primary)]">Tracking coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-[var(--primary)]" />
              <p className="font-semibold text-[var(--text-primary)]">Available now</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              User list, organization package, role, activation state, uploaded file storage, and latest recorded voucher activity.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
            <div className="flex items-center gap-3">
              <TimerReset className="h-5 w-5 text-[var(--primary)]" />
              <p className="font-semibold text-[var(--text-primary)]">Not tracked yet</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Exact webapp usage time, user session duration, payment collection method, and subscription expiry date are not in the current schema.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
              <p className="font-semibold text-[var(--text-primary)]">Safe admin view</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              The panel stays honest about missing billing telemetry instead of showing guessed values.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
