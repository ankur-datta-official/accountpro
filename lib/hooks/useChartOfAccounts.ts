"use client"

import { useMemo } from "react"
import useSWR from "swr"

import { createClient } from "@/lib/supabase/client"
import type {
  AccountGroup,
  AccountHead,
  AccountSemiSubGroup,
  AccountSubGroup,
} from "@/lib/types"

export type ChartGroupFilter = "all" | "expense" | "income" | "asset" | "liability"

type ChartResponse = {
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
  accountHeads: AccountHead[]
}

export type ChartTreeHead = AccountHead

export type ChartTreeSubGroup = AccountSubGroup & {
  heads: ChartTreeHead[]
}

export type ChartTreeSemiSubGroup = AccountSemiSubGroup & {
  subGroups: ChartTreeSubGroup[]
}

export type ChartTreeGroup = AccountGroup & {
  semiSubGroups: ChartTreeSemiSubGroup[]
}

export type ChartFlatAccount = {
  id: string
  name: string
  openingBalance: number
  balanceType: "debit" | "credit"
  isActive: boolean
  groupId: string
  groupName: string
  groupType: AccountGroup["type"]
  semiSubGroupId: string
  semiSubGroupName: string
  subGroupId: string
  subGroupName: string
  label: string
}

type FetchKey = [string, string]

async function fetchChartOfAccounts([url]: FetchKey): Promise<ChartResponse> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Unauthorized")
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Unable to fetch chart of accounts." }))
    throw new Error(result.error ?? "Unable to fetch chart of accounts.")
  }

  return response.json()
}

export function useChartOfAccounts(clientId: string) {
  const key = clientId ? ([`/api/clients/${clientId}/chart-of-accounts`, clientId] as FetchKey) : null
  const swr = useSWR(key, fetchChartOfAccounts, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const tree = useMemo<ChartTreeGroup[]>(() => {
    const groups = swr.data?.groups ?? []
    const semiSubGroups = swr.data?.semiSubGroups ?? []
    const subGroups = swr.data?.subGroups ?? []
    const accountHeads = swr.data?.accountHeads ?? []

    return groups.map((group) => {
      const nestedSemiSubGroups = semiSubGroups
        .filter((semiSubGroup) => semiSubGroup.group_id === group.id)
        .map((semiSubGroup) => {
          const nestedSubGroups = subGroups
            .filter((subGroup) => subGroup.semi_sub_id === semiSubGroup.id)
            .map((subGroup) => ({
              ...subGroup,
              heads: accountHeads.filter((head) => head.sub_group_id === subGroup.id),
            }))

          return {
            ...semiSubGroup,
            subGroups: nestedSubGroups,
          }
        })

      return {
        ...group,
        semiSubGroups: nestedSemiSubGroups,
      }
    })
  }, [swr.data])

  const flatAccounts = useMemo<ChartFlatAccount[]>(() => {
    return tree.flatMap((group) =>
      group.semiSubGroups.flatMap((semiSubGroup) =>
        semiSubGroup.subGroups.flatMap((subGroup) =>
          subGroup.heads.map((head) => ({
            id: head.id,
            name: head.name,
            openingBalance: Number(head.opening_balance ?? 0),
            balanceType: (head.balance_type ?? "debit") as "debit" | "credit",
            isActive: Boolean(head.is_active),
            groupId: group.id,
            groupName: group.name,
            groupType: group.type,
            semiSubGroupId: semiSubGroup.id,
            semiSubGroupName: semiSubGroup.name,
            subGroupId: subGroup.id,
            subGroupName: subGroup.name,
            label: `${head.name} — ${subGroup.name}`,
          }))
        )
      )
    )
  }, [tree])

  return {
    ...swr,
    tree,
    flatAccounts,
    groups: swr.data?.groups ?? [],
    semiSubGroups: swr.data?.semiSubGroups ?? [],
    subGroups: swr.data?.subGroups ?? [],
    accountHeads: swr.data?.accountHeads ?? [],
  }
}
