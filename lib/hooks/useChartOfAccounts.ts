"use client"

import { useMemo } from "react"

import { buildSafeAccountHeadForest } from "@/lib/accounting/account-head-integrity"
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

export type ChartTreeHead = AccountHead & {
  children: ChartTreeHead[]
  path: string[]
  level: number
  isLeaf: boolean
}

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
  parentAccountHeadId: string | null
  label: string
  path: string[]
}

function buildAccountLabel(path: string[]) {
  return path.join(" > ")
}

function flattenPostingAccounts(
  heads: ChartTreeHead[],
  context: {
    group: AccountGroup
    semiSubGroup: AccountSemiSubGroup
    subGroup: AccountSubGroup
  }
): ChartFlatAccount[] {
  return heads.flatMap((head) => {
    const own =
      head.children.length === 0
        ? [
            {
              id: head.id,
              name: head.name,
              openingBalance: Number(head.opening_balance ?? 0),
              balanceType: (head.balance_type ?? "debit") as "debit" | "credit",
              isActive: Boolean(head.is_active),
              groupId: context.group.id,
              groupName: context.group.name,
              groupType: context.group.type,
              semiSubGroupId: context.semiSubGroup.id,
              semiSubGroupName: context.semiSubGroup.name,
              subGroupId: context.subGroup.id,
              subGroupName: context.subGroup.name,
              parentAccountHeadId: head.parent_id ?? null,
              label: buildAccountLabel([
                context.group.name,
                context.semiSubGroup.name,
                context.subGroup.name,
                ...head.path,
              ]),
              path: [context.group.name, context.semiSubGroup.name, context.subGroup.name, ...head.path],
            } satisfies ChartFlatAccount,
          ]
        : []

    return [...own, ...flattenPostingAccounts(head.children, context)]
  })
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
    const accountHeads = (query.data?.accountHeads ?? []).map((head) => ({
      ...head,
      is_active: head.is_active ?? true,
    }))

    return groups.map((group) => ({
      ...group,
      semiSubGroups: semiSubGroups
        .filter((semiSubGroup) => semiSubGroup.group_id === group.id)
        .map((semiSubGroup) => ({
          ...semiSubGroup,
          subGroups: subGroups
            .filter((subGroup) => subGroup.semi_sub_id === semiSubGroup.id)
            .map((subGroup) => ({
              ...subGroup,
              heads: buildSafeAccountHeadForest(
                accountHeads.filter((head) => head.sub_group_id === subGroup.id),
              ) as ChartTreeHead[],
            })),
        })),
    }))
  }, [query.data])

  const flatAccounts = useMemo<ChartFlatAccount[]>(
    () =>
      tree.flatMap((group) =>
        group.semiSubGroups.flatMap((semiSubGroup) =>
          semiSubGroup.subGroups.flatMap((subGroup) =>
            flattenPostingAccounts(subGroup.heads, { group, semiSubGroup, subGroup })
          )
        )
      ),
    [tree]
  )

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
