"use client"

import { useMemo, useState } from "react"
import { Loader2, ShieldAlert, UserX2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EditRoleDialog } from "@/components/team/EditRoleDialog"
import { InviteDialog } from "@/components/team/InviteDialog"
import { useTeam } from "@/lib/hooks/useTeam"
import { formatPlanName, formatRole } from "@/lib/team"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function getInitials(nameOrEmail: string) {
  const segments = nameOrEmail.split(" ").filter(Boolean)
  if (!segments.length) return "AP"
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase()
  return `${segments[0][0]}${segments[1][0]}`.toUpperCase()
}

function roleBadgeClass(role: string) {
  if (role === "owner") return "bg-violet-100 text-violet-700"
  if (role === "admin") return "bg-blue-100 text-blue-700"
  if (role === "accountant") return "bg-emerald-100 text-emerald-700"
  return "bg-slate-100 text-slate-600"
}

function statusDotClass(status: string) {
  if (status === "active") return "bg-emerald-500"
  if (status === "pending") return "bg-amber-500"
  return "bg-slate-400"
}

export function TeamManagement() {
  const team = useTeam()
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const limitLabel = useMemo(() => {
    if (team.limits.limit === null) return "Unlimited members"
    return `${team.stats.totalMembers}/${team.limits.limit} members used`
  }, [team.limits.limit, team.stats.totalMembers])

  const handleDeactivate = async (memberId: string) => {
    setDeactivatingId(memberId)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setDeactivatingId(null)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const response = await fetch(`/api/team/${memberId}/deactivate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const result = await response.json().catch(() => ({ error: "Unable to deactivate member." }))
    setDeactivatingId(null)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to deactivate member.")
      return
    }

    toast.success("Member deactivated.")
    await team.refresh()
  }

  if (team.loading) {
    return (
      <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-16 shadow-sm">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading team members...</span>
      </div>
    )
  }

  if (team.error) {
    return (
      <Card className="rounded-[2rem] border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-destructive">{team.error}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Team Members</h1>
            <p className="mt-1 text-sm text-slate-500">{team.organization?.name ?? "Organization"}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {formatPlanName(team.organization?.plan)} plan - {limitLabel}
            </p>
          </div>

          {team.limits.isAtLimit ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                Member limit reached
              </div>
              Upgrade your plan to invite more members.
            </div>
          ) : (
            <InviteDialog disabled={!team.canManageRoles} onInvited={team.refresh} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total members</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{team.stats.totalMembers}</p>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">{team.stats.activeMembers}</p>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending invitations</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{team.stats.pendingInvitations}</p>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar + Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((member) => {
              const displayName = member.fullName ?? member.email ?? "Pending Member"
              const isCurrentUser = member.userId === team.currentUserId
              const isOwner = member.role === "owner"
              const canEditRole = team.canManageRoles && !isOwner
              const canDeactivate = team.canManageRoles && !isOwner

              return (
                <TableRow key={member.id} className={cn(isCurrentUser ? "bg-sky-50/60" : undefined)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-700">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{displayName}</p>
                        {isCurrentUser ? (
                          <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">You</Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{member.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={cn("rounded-full hover:opacity-100", roleBadgeClass(member.role))}>
                      {formatRole(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", statusDotClass(member.status))} />
                      <span className="capitalize text-slate-700">{member.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.createdAt ? format(new Date(member.createdAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <EditRoleDialog
                        memberId={member.id}
                        currentRole={member.role}
                        memberName={displayName}
                        disabled={!canEditRole}
                        onUpdated={team.refresh}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        disabled={!canDeactivate || deactivatingId === member.id}
                        onClick={() => handleDeactivate(member.id)}
                      >
                        <UserX2 className="mr-1.5 h-3.5 w-3.5" />
                        Deactivate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
