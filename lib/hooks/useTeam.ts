"use client"

import { useCallback } from "react"

import { fetchWithAccessToken, useAppQuery } from "@/lib/query"
import type { OrganizationMemberRole, OrganizationPlan } from "@/lib/types"

export type TeamMemberStatus = "active" | "pending" | "inactive"

export type TeamMemberRow = {
  id: string
  userId: string | null
  role: OrganizationMemberRole
  isActive: boolean
  status: TeamMemberStatus
  invitedEmail: string | null
  invitationMessage: string | null
  email: string | null
  fullName: string | null
  createdAt: string | null
}

type TeamPayload = {
  organization: {
    id: string
    name: string
    plan: OrganizationPlan | null
  } | null
  currentUserId: string
  currentUserRole: OrganizationMemberRole
  canManageRoles: boolean
  stats: {
    totalMembers: number
    activeMembers: number
    pendingInvitations: number
  }
  limits: {
    plan: OrganizationPlan
    limit: number | null
    isAtLimit: boolean
  }
  members: TeamMemberRow[]
}

type TeamState = TeamPayload & {
  loading: boolean
  error: string | null
}

const initialState: TeamState = {
  loading: true,
  error: null,
  organization: null,
  currentUserId: "",
  currentUserRole: "viewer",
  canManageRoles: false,
  stats: {
    totalMembers: 0,
    activeMembers: 0,
    pendingInvitations: 0,
  },
  limits: {
    plan: "starter",
    limit: 3,
    isAtLimit: false,
  },
  members: [],
}

export function useTeam() {
  const query = useAppQuery({
    queryKey: ["team-members"],
    staleTime: 2 * 60 * 1000,
    queryFn: () => fetchWithAccessToken<TeamPayload>("/api/team/members"),
  })

  const refresh = useCallback(async () => {
    await query.refetch()
  }, [query])

  return {
    ...(query.data ?? initialState),
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refresh,
  }
}
