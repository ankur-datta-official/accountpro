import type { AccountHead } from "@/lib/types"

export const MAX_ACCOUNT_HEAD_DEPTH = 8

type HeadLike = Pick<
  AccountHead,
  "id" | "client_id" | "sub_group_id" | "parent_id" | "name" | "sort_order" | "is_active"
>

export type AccountHeadIntegrityCode =
  | "parent_not_found"
  | "self_parent"
  | "cross_client_parent"
  | "cross_sub_group_parent"
  | "circular_parent"
  | "max_depth_exceeded"

export type AccountHeadIntegrityResult =
  | { ok: true }
  | {
      ok: false
      code: AccountHeadIntegrityCode
      message: string
    }

export type SafeHeadTreeNode<T extends HeadLike> = T & {
  children: SafeHeadTreeNode<T>[]
  path: string[]
  level: number
  isLeaf: boolean
}

export type AccountHeadDeleteGuardResult =
  | { ok: true }
  | {
      ok: false
      code: "has_children" | "has_voucher_references" | "has_payroll_mappings"
      message: string
    }

function compareHeads(left: HeadLike, right: HeadLike) {
  const sortDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
  return sortDiff !== 0 ? sortDiff : left.name.localeCompare(right.name)
}

function getHeadMap<T extends HeadLike>(heads: T[]) {
  return new Map(heads.map((head) => [head.id, head]))
}

function getScopedParent<T extends HeadLike>(head: T, headMap: Map<string, T>) {
  const parentId = head.parent_id ?? null
  if (!parentId || parentId === head.id) {
    return null
  }

  const parent = headMap.get(parentId) ?? null
  if (!parent) {
    return null
  }

  if (parent.client_id !== head.client_id) {
    return null
  }

  if (parent.sub_group_id !== head.sub_group_id) {
    return null
  }

  return parent
}

export function validateParentAssignment<T extends HeadLike>(input: {
  headId?: string | null
  parentId?: string | null
  clientId: string
  subGroupId: string
  heads: T[]
  maxDepth?: number
}): AccountHeadIntegrityResult {
  const { headId = null, parentId = null, clientId, subGroupId, heads } = input
  const maxDepth = input.maxDepth ?? MAX_ACCOUNT_HEAD_DEPTH

  if (!parentId) {
    return { ok: true }
  }

  if (headId && headId === parentId) {
    return {
      ok: false,
      code: "self_parent",
      message: "An account head cannot be its own parent.",
    }
  }

  const headMap = getHeadMap(heads)
  const parent = headMap.get(parentId) ?? null

  if (!parent) {
    return {
      ok: false,
      code: "parent_not_found",
      message: "The selected parent account head was not found.",
    }
  }

  if (parent.client_id !== clientId) {
    return {
      ok: false,
      code: "cross_client_parent",
      message: "The selected parent belongs to a different accounting client.",
    }
  }

  if (parent.sub_group_id !== subGroupId) {
    return {
      ok: false,
      code: "cross_sub_group_parent",
      message: "Parent and child must stay inside the same sub-group during the legacy hierarchy transition.",
    }
  }

  const visited = new Set<string>(headId ? [headId] : [])
  let depth = 0
  let current: T | null = parent

  while (current) {
    if (visited.has(current.id)) {
      return {
        ok: false,
        code: "circular_parent",
        message: "This parent selection would create a circular hierarchy.",
      }
    }

    visited.add(current.id)
    depth += 1

    if (depth > maxDepth) {
      return {
        ok: false,
        code: "max_depth_exceeded",
        message: `Account head nesting cannot exceed ${maxDepth} levels.`,
      }
    }

    current = getScopedParent(current, headMap)
  }

  return { ok: true }
}

export function buildSafeAccountHeadForest<T extends HeadLike>(
  heads: T[],
  maxDepth = MAX_ACCOUNT_HEAD_DEPTH
): SafeHeadTreeNode<T>[] {
  const sortedHeads = [...heads].sort(compareHeads)
  const headMap = getHeadMap(sortedHeads)
  const childIdsByParent = new Map<string | null, string[]>()

  for (const head of sortedHeads) {
    const parent = getScopedParent(head, headMap)
    const parentId = parent?.id ?? null
    const siblings = childIdsByParent.get(parentId) ?? []
    siblings.push(head.id)
    childIdsByParent.set(parentId, siblings)
  }

  const built = new Set<string>()

  const buildNode = (
    headId: string,
    pathIds: Set<string>,
    pathNames: string[],
    level: number
  ): SafeHeadTreeNode<T> | null => {
    if (pathIds.has(headId) || level >= maxDepth) {
      return null
    }

    const head = headMap.get(headId)
    if (!head) {
      return null
    }

    built.add(headId)
    const nextPathIds = new Set(pathIds)
    nextPathIds.add(headId)
    const nextPathNames = [...pathNames, head.name]
    const childIds = childIdsByParent.get(head.id) ?? []
    const children = childIds
      .map((childId) => buildNode(childId, nextPathIds, nextPathNames, level + 1))
      .filter((child): child is SafeHeadTreeNode<T> => child !== null)

    return {
      ...head,
      children,
      path: nextPathNames,
      level,
      isLeaf: children.length === 0,
    }
  }

  const roots = (childIdsByParent.get(null) ?? [])
    .map((headId) => buildNode(headId, new Set<string>(), [], 0))
    .filter((node): node is SafeHeadTreeNode<T> => node !== null)

  for (const head of sortedHeads) {
    if (built.has(head.id)) {
      continue
    }

    const orphanRoot = buildNode(head.id, new Set<string>(), [], 0)
    if (orphanRoot) {
      roots.push(orphanRoot)
    }
  }

  return roots
}

export function getAccountHeadPath<T extends HeadLike>(input: {
  head: T
  heads: T[]
  maxDepth?: number
}) {
  const { head, heads } = input
  const maxDepth = input.maxDepth ?? MAX_ACCOUNT_HEAD_DEPTH
  const headMap = getHeadMap(heads)
  const visited = new Set<string>()
  const path: T[] = []
  let current: T | null = head
  let depth = 0

  while (current && !visited.has(current.id) && depth < maxDepth) {
    path.unshift(current)
    visited.add(current.id)
    current = getScopedParent(current, headMap)
    depth += 1
  }

  return path
}

export function hasChildAccountHeads<T extends HeadLike>(headId: string, heads: T[]) {
  return heads.some((candidate) => candidate.parent_id === headId)
}

export function validateAccountHeadDeletion<T extends HeadLike>(input: {
  headId: string
  heads: T[]
  voucherReferenceCount: number
  payrollMappingCount: number
}): AccountHeadDeleteGuardResult {
  if (hasChildAccountHeads(input.headId, input.heads)) {
    return {
      ok: false,
      code: "has_children",
      message: "Parent account heads with child records cannot be deleted.",
    }
  }

  if (input.voucherReferenceCount > 0) {
    return {
      ok: false,
      code: "has_voucher_references",
      message: "Account heads referenced by vouchers cannot be deleted.",
    }
  }

  if (input.payrollMappingCount > 0) {
    return {
      ok: false,
      code: "has_payroll_mappings",
      message: "Account heads referenced by payroll mappings cannot be deleted.",
    }
  }

  return { ok: true }
}
