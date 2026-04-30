"use client"

import { useCallback, useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"
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

function isTeamPayload(value: unknown): value is TeamPayload {
  if (!value || typeof value !== "object") return false
  return "members" in value && "stats" in value && "limits" in value
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
  const [state, setState] = useState<TeamState>(initialState)

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: "Your session has expired. Please sign in again.",
      }))
      return
    }

    const response = await fetch("/api/team/members", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const result = await response.json().catch(() => null)

    if (!response.ok || !result || !isTeamPayload(result)) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error:
          typeof result === "object" && result !== null && "error" in result
            ? String((result as { error?: string }).error ?? "Unable to load team members.")
            : "Unable to load team members.",
      }))
      return
    }

    setState({
      ...result,
      loading: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    ...state,
    refresh,
  }
}
