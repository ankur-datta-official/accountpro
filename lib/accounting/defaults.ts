import { createClient } from "@supabase/supabase-js"

import { defaultChartTemplate } from "@/lib/accounting/default-chart-template"
import type {
  AccountGroupType,
  Database,
  PaymentModeInsert,
  PaymentModeType,
} from "@/lib/types"

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>
type AccountGroupRow = Database["public"]["Tables"]["account_groups"]["Row"]
type AccountSemiSubGroupRow = Database["public"]["Tables"]["account_semi_sub_groups"]["Row"]
type AccountSubGroupRow = Database["public"]["Tables"]["account_sub_groups"]["Row"]
type AccountHeadRow = Database["public"]["Tables"]["account_heads"]["Row"]

const defaultPaymentModes: Array<{
  name: string
  type: PaymentModeType
  account_no?: string | null
  is_active: boolean
}> = [
  { name: "Cash", type: "cash", is_active: true },
  { name: "Mutual Bank", type: "bank", is_active: true },
  { name: "Islami Bank", type: "bank", is_active: true },
  { name: "Dhaka Bank", type: "bank", is_active: true },
  { name: "ICB Islamic Bank", type: "bank", is_active: true },
]

const PAYMENT_MODE_DEFAULT_LOCATION = {
  groupName: "Assets",
  groupType: "asset" as const,
  semiSubGroupName: "Current Assets",
  subGroupName: "Cash & Cash Equivalents",
}

type SyncContext = {
  clientId: string
  supabase: SupabaseAdminClient
  groups: AccountGroupRow[]
  semiSubGroups: AccountSemiSubGroupRow[]
  subGroups: AccountSubGroupRow[]
  accountHeads: AccountHeadRow[]
}

type MaterializedSubGroup = {
  groupType: AccountGroupType
  groupId: string
  groupName: string
  semiSubGroupId: string
  semiSubGroupName: string
  subGroupId: string
  subGroupName: string
  headPaths: string[][]
}

type MaterializedSemiSubGroup = {
  groupType: AccountGroupType
  groupId: string
  groupName: string
  semiSubGroupId: string
  semiSubGroupName: string
  subGroups: MaterializedSubGroup[]
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function matchesName(value: string | null | undefined, expected: string) {
  return typeof value === "string" && normalizeName(value) === normalizeName(expected)
}

function nextSortOrder(values: Array<{ sort_order: number | null }>) {
  if (values.length === 0) {
    return 0
  }

  const highest = values.reduce((max, value) => Math.max(max, Number(value.sort_order ?? 0)), -1)
  return highest + 1
}

function inferLeafBalanceType(groupType: AccountGroupType) {
  return groupType === "income" || groupType === "liability" ? "credit" : "debit"
}

async function buildSyncContext(
  clientId: string,
  supabase: SupabaseAdminClient
): Promise<SyncContext> {
  const [groupsRes, semiRes, subRes, headsRes] = await Promise.all([
    supabase.from("account_groups").select("*").eq("client_id", clientId).order("sort_order"),
    supabase
      .from("account_semi_sub_groups")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order"),
    supabase.from("account_sub_groups").select("*").eq("client_id", clientId).order("sort_order"),
    supabase.from("account_heads").select("*").eq("client_id", clientId).order("sort_order"),
  ])

  const error = groupsRes.error ?? semiRes.error ?? subRes.error ?? headsRes.error
  if (error) {
    throw new Error(error.message ?? "Unable to load the existing chart of accounts.")
  }

  return {
    clientId,
    supabase,
    groups: (groupsRes.data ?? []) as AccountGroupRow[],
    semiSubGroups: (semiRes.data ?? []) as AccountSemiSubGroupRow[],
    subGroups: (subRes.data ?? []) as AccountSubGroupRow[],
    accountHeads: (headsRes.data ?? []) as AccountHeadRow[],
  }
}

async function ensureGroup(
  context: SyncContext,
  {
    name,
    type,
  }: {
    name: string
    type: AccountGroupType
  }
) {
  const existing =
    context.groups.find(
      (group) => group.client_id === context.clientId && matchesName(group.name, name)
    ) ?? null

  if (existing) {
    return existing
  }

  const { data, error } = await context.supabase
    .from("account_groups")
    .insert({
      client_id: context.clientId,
      name,
      type,
      sort_order: nextSortOrder(context.groups),
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to create group ${name}.`)
  }

  context.groups.push(data)
  return data
}

async function ensureSemiSubGroup(
  context: SyncContext,
  {
    groupId,
    name,
  }: {
    groupId: string
    name: string
  }
) {
  const existing =
    context.semiSubGroups.find(
      (semiSubGroup) =>
        semiSubGroup.client_id === context.clientId &&
        semiSubGroup.group_id === groupId &&
        matchesName(semiSubGroup.name, name)
    ) ?? null

  if (existing) {
    return existing
  }

  const siblings = context.semiSubGroups.filter(
    (semiSubGroup) =>
      semiSubGroup.client_id === context.clientId && semiSubGroup.group_id === groupId
  )

  const { data, error } = await context.supabase
    .from("account_semi_sub_groups")
    .insert({
      client_id: context.clientId,
      group_id: groupId,
      name,
      sort_order: nextSortOrder(siblings),
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to create semi-sub-group ${name}.`)
  }

  context.semiSubGroups.push(data)
  return data
}

async function ensureSubGroup(
  context: SyncContext,
  {
    semiSubGroupId,
    name,
  }: {
    semiSubGroupId: string
    name: string
  }
) {
  const existing =
    context.subGroups.find(
      (subGroup) =>
        subGroup.client_id === context.clientId &&
        subGroup.semi_sub_id === semiSubGroupId &&
        matchesName(subGroup.name, name)
    ) ?? null

  if (existing) {
    return existing
  }

  const siblings = context.subGroups.filter(
    (subGroup) =>
      subGroup.client_id === context.clientId && subGroup.semi_sub_id === semiSubGroupId
  )

  const { data, error } = await context.supabase
    .from("account_sub_groups")
    .insert({
      client_id: context.clientId,
      semi_sub_id: semiSubGroupId,
      name,
      sort_order: nextSortOrder(siblings),
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to create sub-group ${name}.`)
  }

  context.subGroups.push(data)
  return data
}

function getHeadsInSubGroup(context: SyncContext, subGroupId: string) {
  return context.accountHeads.filter(
    (head) => head.client_id === context.clientId && head.sub_group_id === subGroupId
  )
}

function getRootHeadsInSubGroup(context: SyncContext, subGroupId: string) {
  return getHeadsInSubGroup(context, subGroupId).filter((head) => (head.parent_id ?? null) === null)
}

function getChildHeads(context: SyncContext, headId: string) {
  return context.accountHeads.filter(
    (head) => head.client_id === context.clientId && (head.parent_id ?? null) === headId
  )
}

async function updateHeadRecord(
  context: SyncContext,
  head: AccountHeadRow,
  values: Partial<Database["public"]["Tables"]["account_heads"]["Update"]>
) {
  const { data, error } = await context.supabase
    .from("account_heads")
    .update(values)
    .eq("id", head.id)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to update account head ${head.name}.`)
  }

  const index = context.accountHeads.findIndex((candidate) => candidate.id === head.id)
  if (index >= 0) {
    context.accountHeads[index] = data
  }

  return data
}

async function deleteSubGroupIfEmpty(context: SyncContext, subGroupId: string) {
  const remainingHeads = getHeadsInSubGroup(context, subGroupId)
  if (remainingHeads.length > 0) {
    return
  }

  const { error } = await context.supabase
    .from("account_sub_groups")
    .delete()
    .eq("id", subGroupId)
    .eq("client_id", context.clientId)

  if (error) {
    return
  }

  context.subGroups = context.subGroups.filter((subGroup) => subGroup.id !== subGroupId)
}

async function removeRedundantHead(context: SyncContext, head: AccountHeadRow) {
  const hasChildren = getChildHeads(context, head.id).length > 0
  if (hasChildren) {
    return
  }

  const { error: deleteError } = await context.supabase
    .from("account_heads")
    .delete()
    .eq("id", head.id)
    .eq("client_id", context.clientId)

  if (!deleteError) {
    context.accountHeads = context.accountHeads.filter((candidate) => candidate.id !== head.id)
    return
  }

  await updateHeadRecord(context, head, { is_active: false })
}

async function updateExistingHeadDefaults(
  context: SyncContext,
  head: AccountHeadRow,
  {
    groupType,
    isLeaf,
  }: {
    groupType: AccountGroupType
    isLeaf: boolean
  }
) {
  const nextType = head.type ?? groupType
  const nextBalanceType = isLeaf ? (head.balance_type ?? inferLeafBalanceType(groupType)) : head.balance_type

  if (nextType === head.type && nextBalanceType === head.balance_type) {
    return head
  }

  return updateHeadRecord(context, head, {
    type: nextType,
    balance_type: nextBalanceType,
  })
}

async function ensureHeadNode(
  context: SyncContext,
  {
    subGroupId,
    parentId,
    name,
    groupType,
    isLeaf,
  }: {
    subGroupId: string
    parentId: string | null
    name: string
    groupType: AccountGroupType
    isLeaf: boolean
  }
) {
  const existing =
    context.accountHeads.find(
      (head) =>
        head.client_id === context.clientId &&
        head.sub_group_id === subGroupId &&
        (head.parent_id ?? null) === parentId &&
        matchesName(head.name, name)
    ) ?? null

  if (existing) {
    return updateExistingHeadDefaults(context, existing, { groupType, isLeaf })
  }

  const siblings = context.accountHeads.filter(
    (head) =>
      head.client_id === context.clientId &&
      head.sub_group_id === subGroupId &&
      (head.parent_id ?? null) === parentId
  )

  const { data, error } = await context.supabase
    .from("account_heads")
    .insert({
      client_id: context.clientId,
      sub_group_id: subGroupId,
      parent_id: parentId,
      name,
      opening_balance: 0,
      balance_type: isLeaf ? inferLeafBalanceType(groupType) : null,
      is_active: true,
      sort_order: nextSortOrder(siblings),
      type: groupType,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to create account head ${name}.`)
  }

  context.accountHeads.push(data)
  return data
}

async function ensureHeadPath(
  context: SyncContext,
  {
    subGroupId,
    groupType,
    path,
  }: {
    subGroupId: string
    groupType: AccountGroupType
    path: string[]
  }
) {
  let parentId: string | null = null

  for (let index = 0; index < path.length; index += 1) {
    const head = await ensureHeadNode(context, {
      subGroupId,
      parentId,
      name: path[index],
      groupType,
      isLeaf: index === path.length - 1,
    })

    parentId = head.id
  }
}

async function ensurePaymentModeAccountHeadInContext(
  context: SyncContext,
  paymentModeName: string
) {
  const existingByName =
    context.accountHeads.find(
      (head) =>
        head.client_id === context.clientId && matchesName(head.name, paymentModeName)
    ) ?? null

  if (existingByName) {
    return existingByName
  }

  const group = await ensureGroup(context, {
    name: PAYMENT_MODE_DEFAULT_LOCATION.groupName,
    type: PAYMENT_MODE_DEFAULT_LOCATION.groupType,
  })
  const semiSubGroup = await ensureSemiSubGroup(context, {
    groupId: group.id,
    name: PAYMENT_MODE_DEFAULT_LOCATION.semiSubGroupName,
  })
  const subGroup = await ensureSubGroup(context, {
    semiSubGroupId: semiSubGroup.id,
    name: PAYMENT_MODE_DEFAULT_LOCATION.subGroupName,
  })

  return ensureHeadNode(context, {
    subGroupId: subGroup.id,
    parentId: null,
    name: paymentModeName,
    groupType: PAYMENT_MODE_DEFAULT_LOCATION.groupType,
    isLeaf: true,
  })
}

export function createDefaultPaymentModes(clientId: string): PaymentModeInsert[] {
  return defaultPaymentModes.map((mode) => ({
    client_id: clientId,
    name: mode.name,
    type: mode.type,
    account_no: mode.account_no ?? null,
    is_active: mode.is_active,
  }))
}

async function materializeDefaultStructure(context: SyncContext): Promise<MaterializedSemiSubGroup[]> {
  const materialized: MaterializedSemiSubGroup[] = []
  for (const groupDefinition of defaultChartTemplate) {
    const group = await ensureGroup(context, {
      name: groupDefinition.name,
      type: groupDefinition.type,
    })

    for (const semiDefinition of groupDefinition.semiSubGroups) {
      const semiSubGroup = await ensureSemiSubGroup(context, {
        groupId: group.id,
        name: semiDefinition.name,
      })

      const materializedSemi: MaterializedSemiSubGroup = {
        groupType: groupDefinition.type,
        groupId: group.id,
        groupName: group.name,
        semiSubGroupId: semiSubGroup.id,
        semiSubGroupName: semiSubGroup.name,
        subGroups: [],
      }

      for (const subDefinition of semiDefinition.subGroups) {
        const subGroup = await ensureSubGroup(context, {
          semiSubGroupId: semiSubGroup.id,
          name: subDefinition.name,
        })

        materializedSemi.subGroups.push({
          groupType: groupDefinition.type,
          groupId: group.id,
          groupName: group.name,
          semiSubGroupId: semiSubGroup.id,
          semiSubGroupName: semiSubGroup.name,
          subGroupId: subGroup.id,
          subGroupName: subGroup.name,
          headPaths: subDefinition.headPaths,
        })
      }

      materialized.push(materializedSemi)
    }
  }

  return materialized
}

async function repairLegacyDefaultChartLayout(
  context: SyncContext,
  materialized: MaterializedSemiSubGroup[]
) {
  for (const semiSubGroup of materialized) {
    const fallbackSubGroup =
      semiSubGroup.subGroups.find((subGroup) =>
        matchesName(subGroup.subGroupName, semiSubGroup.semiSubGroupName)
      ) ?? null

    if (fallbackSubGroup) {
      for (const headPath of fallbackSubGroup.headPaths) {
        if (headPath.length !== 1) {
          continue
        }

        const misplacedSubGroup =
          context.subGroups.find(
            (subGroup) =>
              subGroup.client_id === context.clientId &&
              subGroup.semi_sub_id === semiSubGroup.semiSubGroupId &&
              subGroup.id !== fallbackSubGroup.subGroupId &&
              matchesName(subGroup.name, headPath[0])
          ) ?? null

        if (!misplacedSubGroup) {
          continue
        }

        const candidateHead =
          getRootHeadsInSubGroup(context, misplacedSubGroup.id).find((head) =>
            matchesName(head.name, headPath[0])
          ) ?? null

        if (!candidateHead) {
          continue
        }

        await updateHeadRecord(context, candidateHead, {
          sub_group_id: fallbackSubGroup.subGroupId,
          parent_id: null,
          type: semiSubGroup.groupType,
          balance_type: inferLeafBalanceType(semiSubGroup.groupType),
          is_active: true,
        })

        await deleteSubGroupIfEmpty(context, misplacedSubGroup.id)
      }
    }

    for (const subGroup of semiSubGroup.subGroups) {
      const expectedRootNames = new Set(
        subGroup.headPaths
          .map((headPath) => headPath[0])
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalizeName(value))
      )

      if (expectedRootNames.has(normalizeName(subGroup.subGroupName))) {
        continue
      }

      const redundantHead =
        getRootHeadsInSubGroup(context, subGroup.subGroupId).find((head) =>
          matchesName(head.name, subGroup.subGroupName)
        ) ?? null

      if (!redundantHead) {
        continue
      }

      await removeRedundantHead(context, redundantHead)
    }
  }
}

async function ensureMaterializedHeadPaths(
  context: SyncContext,
  materialized: MaterializedSemiSubGroup[]
) {
  for (const semiSubGroup of materialized) {
    for (const subGroup of semiSubGroup.subGroups) {
      for (const headPath of subGroup.headPaths) {
        await ensureHeadPath(context, {
          subGroupId: subGroup.subGroupId,
          groupType: semiSubGroup.groupType,
          path: headPath,
        })
      }
    }
  }
}

export async function createDefaultChartOfAccounts(
  clientId: string,
  supabase: SupabaseAdminClient
) {
  const context = await buildSyncContext(clientId, supabase)
  const materialized = await materializeDefaultStructure(context)

  await repairLegacyDefaultChartLayout(context, materialized)
  await ensureMaterializedHeadPaths(context, materialized)

  for (const paymentMode of defaultPaymentModes) {
    await ensurePaymentModeAccountHeadInContext(context, paymentMode.name)
  }
}

export async function createPaymentModeAccountHeadForClient(
  clientId: string,
  paymentModeName: string,
  supabase: SupabaseAdminClient
) {
  const context = await buildSyncContext(clientId, supabase)
  await ensurePaymentModeAccountHeadInContext(context, paymentModeName)
}

export async function syncPaymentModeAccountHeadForClient(
  clientId: string,
  {
    previousName,
    nextName,
  }: {
    previousName: string
    nextName: string
  },
  supabase: SupabaseAdminClient
) {
  if (previousName === nextName) {
    await createPaymentModeAccountHeadForClient(clientId, nextName, supabase)
    return
  }

  const { data: existingNextHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", nextName)
    .maybeSingle()

  if (existingNextHead) {
    return
  }

  const { data: previousHead } = await supabase
    .from("account_heads")
    .select("id")
    .eq("client_id", clientId)
    .eq("name", previousName)
    .maybeSingle()

  if (previousHead?.id) {
    await supabase.from("account_heads").update({ name: nextName }).eq("id", previousHead.id)
    return
  }

  await createPaymentModeAccountHeadForClient(clientId, nextName, supabase)
}
