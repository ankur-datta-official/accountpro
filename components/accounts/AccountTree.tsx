"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { ChartGroupFilter, ChartTreeGroup } from "@/lib/hooks/useChartOfAccounts"
import type { AccountGroup, AccountSemiSubGroup, AccountSubGroup } from "@/lib/types"
import { AddAccountHeadDialog } from "@/components/accounts/AddAccountHeadDialog"
import { DeactivateAccountHeadButton } from "@/components/accounts/account-head-actions"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const groupStyles: Record<Exclude<ChartGroupFilter, "all">, string> = {
  expense: "border-red-200 bg-red-50 text-red-700",
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  asset: "border-blue-200 bg-blue-50 text-blue-700",
  liability: "border-amber-200 bg-amber-50 text-amber-700",
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
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-4 text-left"
              onClick={() => toggle(groupKey)}
            >
              <div className="flex items-center gap-3">
                {isGroupOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                <div>
                  <p className="text-lg font-semibold text-slate-950">{group.name}</p>
                  <Badge className={cn("mt-2 rounded-full border", colorClass)}>
                    {group.type.charAt(0).toUpperCase() + group.type.slice(1)}
                  </Badge>
                </div>
              </div>
            </button>

            {isGroupOpen ? (
              <div className="border-t border-slate-200 px-5 py-4">
                {group.semiSubGroups.map((semiSubGroup) => {
                  const semiKey = `semi-${semiSubGroup.id}`
                  const isSemiOpen = expanded[semiKey] ?? true

                  return (
                    <div key={semiSubGroup.id} className="mb-4 last:mb-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-left"
                        onClick={() => toggle(semiKey)}
                      >
                        {isSemiOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                        <span className="font-medium text-slate-900">{semiSubGroup.name}</span>
                      </button>

                      {isSemiOpen ? (
                        <div className="mt-3 space-y-3 pl-4">
                          {semiSubGroup.subGroups.map((subGroup) => {
                            const subKey = `sub-${subGroup.id}`
                            const isSubOpen = expanded[subKey] ?? true

                            return (
                              <div key={subGroup.id} className="rounded-2xl border border-slate-200">
                                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 text-left"
                                    onClick={() => toggle(subKey)}
                                  >
                                    {isSubOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                    <span className="font-medium text-slate-900">{subGroup.name}</span>
                                  </button>
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

                                {isSubOpen ? (
                                  <div className="border-t border-slate-200">
                                    <div className="grid grid-cols-[1.5fr_0.6fr_0.6fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      <span>Name</span>
                                      <span>Opening Balance</span>
                                      <span>Balance Type</span>
                                      <span>Actions</span>
                                    </div>
                                    {subGroup.heads.length ? (
                                      subGroup.heads.map((head) => (
                                        <div
                                          key={head.id}
                                          className="grid grid-cols-[1.5fr_0.6fr_0.6fr_1fr] gap-3 border-t border-slate-200 px-4 py-3 text-sm"
                                        >
                                          <div>
                                            <p className="font-medium text-slate-900">{head.name}</p>
                                            <p className="text-xs text-slate-500">
                                              {head.is_active ? "Active" : "Inactive"}
                                            </p>
                                          </div>
                                          <span className="text-slate-700">
                                            {Number(head.opening_balance ?? 0).toFixed(2)}
                                          </span>
                                          <span className="capitalize text-slate-700">
                                            {head.balance_type ?? "debit"}
                                          </span>
                                          <div className="flex flex-wrap gap-2">
                                            <AddAccountHeadDialog
                                              clientId={clientId}
                                              groups={normalizedGroups}
                                              semiSubGroups={semiSubGroups}
                                              subGroups={subGroups}
                                              head={head}
                                            />
                                            <DeactivateAccountHeadButton
                                              clientId={clientId}
                                              accountHeadId={head.id}
                                              disabled={!head.is_active}
                                            />
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="px-4 py-4 text-sm text-slate-500">
                                        No account heads in this sub-group yet.
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
