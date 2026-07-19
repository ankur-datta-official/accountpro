import type {
  AccountGroup,
  AccountGroupType,
  AccountHead,
  AccountSemiSubGroup,
  AccountSubGroup,
} from "@/lib/types"

export type ChartHierarchyNode = AccountHead & {
  children: ChartHierarchyNode[]
}

export type ChartHierarchySelection = {
  groupId: string | null
  semiSubGroupId: string | null
  subGroupId: string | null
}

function buildNodeMap(nodes: ChartHierarchyNode[], map = new Map<string, ChartHierarchyNode>()) {
  for (const node of nodes) {
    map.set(node.id, node)
    buildNodeMap(node.children, map)
  }

  return map
}

export function findHierarchyNode(nodes: ChartHierarchyNode[], nodeId: string | null | undefined) {
  if (!nodeId) {
    return null
  }

  return buildNodeMap(nodes).get(nodeId) ?? null
}

export function getHierarchyPath(nodes: ChartHierarchyNode[], nodeId: string | null | undefined) {
  if (!nodeId) {
    return []
  }

  const nodeMap = buildNodeMap(nodes)
  const path: ChartHierarchyNode[] = []
  let current = nodeMap.get(nodeId) ?? null

  while (current) {
    path.unshift(current)
    current = current.parent_id ? nodeMap.get(current.parent_id) ?? null : null
  }

  return path
}

export function deriveHierarchySelection(
  nodes: ChartHierarchyNode[],
  nodeId: string | null | undefined
): ChartHierarchySelection {
  const path = getHierarchyPath(nodes, nodeId)

  return {
    groupId: path[0]?.id ?? null,
    semiSubGroupId: path[1]?.id ?? null,
    subGroupId: path[2]?.id ?? null,
  }
}

export function getHierarchyMetaFromPath(path: string[]) {
  const groupName = path[0] ?? ""
  const semiSubGroupName = path.length >= 3 ? path[1] : path[1] ?? ""
  const subGroupName = path.length >= 4 ? path[path.length - 2] : semiSubGroupName

  return {
    groupName,
    semiSubGroupName,
    subGroupName,
  }
}

export type AccountHierarchyLookup = {
  accountHeads: AccountHead[]
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
}

export type ResolvedAccountHierarchy = {
  groupId: string | null
  groupName: string
  groupType: AccountGroupType
  semiSubGroupId: string | null
  semiSubGroupName: string
  subGroupId: string | null
  subGroupName: string
  path: string[]
}

function getParentPath(head: AccountHead, allHeads: AccountHead[]) {
  const path: string[] = [head.name]
  let current = head

  while (current.parent_id) {
    const parent = allHeads.find((candidate) => candidate.id === current.parent_id)
    if (!parent) {
      break
    }

    path.unshift(parent.name)
    current = parent
  }

  return path
}

function getParentRootType(head: AccountHead, allHeads: AccountHead[]): AccountGroupType {
  if (head.type) {
    return head.type as AccountGroupType
  }

  if (!head.parent_id) {
    return "asset"
  }

  const parent = allHeads.find((candidate) => candidate.id === head.parent_id)
  return parent ? getParentRootType(parent, allHeads) : "asset"
}

export function resolveAccountHierarchy(
  head: AccountHead,
  lookup: AccountHierarchyLookup
): ResolvedAccountHierarchy {
  if (head.sub_group_id) {
    const subGroup = lookup.subGroups.find((candidate) => candidate.id === head.sub_group_id) ?? null
    const semiSubGroup = subGroup
      ? lookup.semiSubGroups.find((candidate) => candidate.id === subGroup.semi_sub_id) ?? null
      : null
    const group = semiSubGroup
      ? lookup.groups.find((candidate) => candidate.id === semiSubGroup.group_id) ?? null
      : null

    if (group && semiSubGroup && subGroup) {
      return {
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        semiSubGroupId: semiSubGroup.id,
        semiSubGroupName: semiSubGroup.name,
        subGroupId: subGroup.id,
        subGroupName: subGroup.name,
        path: [group.name, semiSubGroup.name, subGroup.name, head.name],
      }
    }
  }

  const path = getParentPath(head, lookup.accountHeads)
  const meta = getHierarchyMetaFromPath(path)

  return {
    groupId: null,
    groupName: meta.groupName || head.name,
    groupType: getParentRootType(head, lookup.accountHeads),
    semiSubGroupId: null,
    semiSubGroupName: meta.semiSubGroupName,
    subGroupId: null,
    subGroupName: meta.subGroupName,
    path,
  }
}
