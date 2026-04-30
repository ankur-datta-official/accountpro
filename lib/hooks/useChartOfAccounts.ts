"use client"

import { useMemo } from "react"

import { fetchWithAccessToken, useAppQuery } from "@/lib/query"
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

export function useChartOfAccounts(clientId: string) {
  const query = useAppQuery({
    queryKey: ["chart-of-accounts", clientId],
    enabled: Boolean(clientId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchWithAccessToken<ChartResponse>(`/api/clients/${clientId}/chart-of-accounts`),
  })

  const tree = useMemo<ChartTreeGroup[]>(() => {
    const groups = query.data?.groups ?? []
    const semiSubGroups = query.data?.semiSubGroups ?? []
    const subGroups = query.data?.subGroups ?? []
    const accountHeads = query.data?.accountHeads ?? []

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
  }, [query.data])

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
            label: `${head.name} - ${subGroup.name}`,
          }))
        )
      )
    )
  }, [tree])

  return {
    ...query,
    tree,
    flatAccounts,
    groups: query.data?.groups ?? [],
    semiSubGroups: query.data?.semiSubGroups ?? [],
    subGroups: query.data?.subGroups ?? [],
    accountHeads: query.data?.accountHeads ?? [],
  }
}
