"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { ChartGroupFilter, ChartTreeGroup, ChartTreeHead } from "@/lib/hooks/useChartOfAccounts"
import type { AccountGroup, AccountSemiSubGroup, AccountSubGroup } from "@/lib/types"
import { AddAccountHeadDialog } from "@/components/accounts/AddAccountHeadDialog"
import { DeactivateAccountHeadButton } from "@/components/accounts/account-head-actions"
import { DeleteHierarchyButton } from "@/components/accounts/delete-hierarchy-button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const groupStyles: Record<Exclude<ChartGroupFilter, "all">, string> = {
  expense: "border-red-200 bg-red-50 text-red-700",
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  asset: "border-blue-200 bg-blue-50 text-blue-700",
  liability: "border-amber-200 bg-amber-50 text-amber-700",
}

function normalizeHierarchyName(value: string) {
  return value.trim().toLowerCase()
}

function AccountHeadNodeRow({
  clientId,
  groupId,
  semiSubGroupId,
  subGroupId,
  head,
  groups,
  semiSubGroups,
  subGroups,
  expanded,
  toggle,
}: {
  clientId: string
  groupId: string
  semiSubGroupId: string
  subGroupId: string
  head: ChartTreeHead
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
  expanded: Record<string, boolean>
  toggle: (key: string) => void
}) {
  const hasChildren = head.children.length > 0
  const isOpen = expanded[`head-${head.id}`] ?? true
  const indent = `${Math.min(head.level, 5) * 1.25}rem`

  return (
    <div className="border-t border-slate-200">
      <div
        className="grid grid-cols-[minmax(0,1.5fr)_110px_110px_minmax(0,260px)] gap-3 px-4 py-3 text-sm"
        style={{ paddingLeft: `calc(1rem + ${indent})` }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button type="button" className="shrink-0" onClick={() => toggle(`head-${head.id}`)}>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </button>
            ) : (
              <span className="inline-block h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{head.name}</p>
              <p className="text-xs text-slate-500">
                {hasChildren ? `${head.children.length} item${head.children.length === 1 ? "" : "s"} inside` : head.is_active ? "Ready to use" : "Inactive"}
              </p>
            </div>
          </div>
        </div>
        <span className="text-slate-700">{hasChildren ? "-" : Number(head.opening_balance ?? 0).toFixed(2)}</span>
        <span className="capitalize text-slate-700">{hasChildren ? "Branch" : head.balance_type ?? "debit"}</span>
        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
          <AddAccountHeadDialog
            clientId={clientId}
            groups={groups}
            semiSubGroups={semiSubGroups}
            subGroups={subGroups}
            defaultGroupId={groupId}
            defaultSemiSubGroupId={semiSubGroupId}
            defaultSubGroupId={subGroupId}
            defaultParentAccountHeadId={head.id}
          />
          <AddAccountHeadDialog
            clientId={clientId}
            groups={groups}
            semiSubGroups={semiSubGroups}
            subGroups={subGroups}
            head={head}
          />
          {!hasChildren ? (
            <DeactivateAccountHeadButton
              clientId={clientId}
              accountHeadId={head.id}
              disabled={!head.is_active}
            />
          ) : null}
        </div>
      </div>

      {hasChildren && isOpen ? (
        <div>
          {head.children.map((child) => (
            <AccountHeadNodeRow
              key={child.id}
              clientId={clientId}
              groupId={groupId}
              semiSubGroupId={semiSubGroupId}
              subGroupId={subGroupId}
              head={child}
              groups={groups}
              semiSubGroups={semiSubGroups}
              subGroups={subGroups}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function AccountTree({
  clientId,
  tree,
  groups,
  semiSubGroups,
  subGroups,
}: {
  clientId: string
  tree: ChartTreeGroup[]
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const normalizedGroups = useMemo(() => groups, [groups])

  return (
    <div className="space-y-4">
      {tree.map((group) => {
        const groupKey = `group-${group.id}`
        const isGroupOpen = expanded[groupKey] ?? true
        const colorClass = groupStyles[group.type]

        return (
          <div key={group.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => toggle(groupKey)}
              >
                {isGroupOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-950">{group.name}</p>
                  <Badge className={cn("mt-2 rounded-full border", colorClass)}>
                    {group.type.charAt(0).toUpperCase() + group.type.slice(1)}
                  </Badge>
                </div>
              </button>
              <DeleteHierarchyButton
                clientId={clientId}
                itemId={group.id}
                itemName={group.name}
                level="group"
              />
            </div>

            {isGroupOpen ? (
              <div className="border-t border-slate-200 px-5 py-4">
                {group.semiSubGroups.map((semiSubGroup) => {
                  const semiKey = `semi-${semiSubGroup.id}`
                  const isSemiOpen = expanded[semiKey] ?? true

                  return (
                    <div key={semiSubGroup.id} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => toggle(semiKey)}
                        >
                          {isSemiOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
                          <span className="truncate font-medium text-slate-900">{semiSubGroup.name}</span>
                        </button>
                        <DeleteHierarchyButton
                          clientId={clientId}
                          itemId={semiSubGroup.id}
                          itemName={semiSubGroup.name}
                          level="category"
                          className="h-8 px-2 whitespace-nowrap text-destructive hover:bg-white hover:text-destructive"
                        />
                      </div>

                      {isSemiOpen ? (
                        <div className="mt-3 space-y-3 pl-4">
                          {semiSubGroup.subGroups.map((subGroup) => {
                            const subKey = `sub-${subGroup.id}`
                            const isSubOpen = expanded[subKey] ?? true
                            const shouldCollapseSubGroup =
                              normalizeHierarchyName(semiSubGroup.name) ===
                              normalizeHierarchyName(subGroup.name)

                            return (
                              <div key={subGroup.id} className="rounded-2xl border border-slate-200">
                                {shouldCollapseSubGroup ? (
                                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-slate-900">{subGroup.name}</span>
                                      <DeleteHierarchyButton
                                        clientId={clientId}
                                        itemId={subGroup.id}
                                        itemName={subGroup.name}
                                        level="sub-category"
                                        className="h-8 px-2 whitespace-nowrap text-destructive hover:text-destructive"
                                      />
                                    </div>
                                    <AddAccountHeadDialog
                                      clientId={clientId}
                                      groups={normalizedGroups}
                                      semiSubGroups={semiSubGroups}
                                      subGroups={subGroups}
                                      defaultGroupId={group.id}
                                      defaultSemiSubGroupId={semiSubGroup.id}
                                      defaultSubGroupId={subGroup.id}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <button
                                        type="button"
                                        className="flex min-w-0 items-center gap-2 text-left"
                                        onClick={() => toggle(subKey)}
                                      >
                                        {isSubOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
                                        <span className="truncate font-medium text-slate-900">{subGroup.name}</span>
                                      </button>
                                      <DeleteHierarchyButton
                                        clientId={clientId}
                                        itemId={subGroup.id}
                                        itemName={subGroup.name}
                                        level="sub-category"
                                        className="h-8 px-2 whitespace-nowrap text-destructive hover:text-destructive"
                                      />
                                    </div>
                                    <AddAccountHeadDialog
                                      clientId={clientId}
                                      groups={normalizedGroups}
                                      semiSubGroups={semiSubGroups}
                                      subGroups={subGroups}
                                      defaultGroupId={group.id}
                                      defaultSemiSubGroupId={semiSubGroup.id}
                                      defaultSubGroupId={subGroup.id}
                                    />
                                  </div>
                                )}

                                {shouldCollapseSubGroup || isSubOpen ? (
                                  <div className="border-t border-slate-200">
                                    <div className="grid grid-cols-[minmax(0,1.5fr)_110px_110px_minmax(0,260px)] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      <span>Account / Branch</span>
                                      <span>Opening Balance</span>
                                      <span>Balance Type</span>
                                      <span className="text-right">Actions</span>
                                    </div>
                                    {subGroup.heads.length ? (
                                      subGroup.heads.map((head) => (
                                        <AccountHeadNodeRow
                                          key={head.id}
                                          clientId={clientId}
                                          groupId={group.id}
                                          semiSubGroupId={semiSubGroup.id}
                                          subGroupId={subGroup.id}
                                          head={head}
                                          groups={normalizedGroups}
                                          semiSubGroups={semiSubGroups}
                                          subGroups={subGroups}
                                          expanded={expanded}
                                          toggle={toggle}
                                        />
                                      ))
                                    ) : (
                                      <div className="px-4 py-4 text-sm text-slate-500">
                                        Nothing has been added here yet. Use the button above to create the first item.
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
