"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import {
  useChartOfAccounts,
  type ChartFlatAccount,
  type ChartGroupFilter,
  type ChartTreeGroup,
  type ChartTreeHead,
} from "@/lib/hooks/useChartOfAccounts"
import { AddAccountHeadDialog } from "@/components/accounts/AddAccountHeadDialog"
import { AccountTable } from "@/components/accounts/AccountTable"
import { AccountTree } from "@/components/accounts/AccountTree"
import { Button } from "@/components/ui/button"
import { Autocomplete } from "@/components/ui/autocomplete"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type AccountSearchOption = {
  id: string
  label: string
  value: string
  displayLabel: string
  path: string[]
}

function buildSearchLabel(account: ChartFlatAccount) {
  return `${account.name} - ${account.path.join(" > ")}`
}

function treeContainsSelectedHead(heads: ChartTreeHead[], selectedAccountId: string): boolean {
  return heads.some(
    (head) =>
      head.id === selectedAccountId || treeContainsSelectedHead(head.children, selectedAccountId)
  )
}

function filterTreeBySearch(
  tree: ChartTreeGroup[],
  groupFilter: ChartGroupFilter,
  normalizedSearch: string,
  selectedAccountId: string | null
): ChartTreeGroup[] {
  return tree
    .filter((group) => groupFilter === "all" || group.type === groupFilter)
    .map((group) => ({
      ...group,
      semiSubGroups: group.semiSubGroups
        .map((semiSubGroup) => ({
          ...semiSubGroup,
          subGroups: semiSubGroup.subGroups
            .map((subGroup) => ({
              ...subGroup,
              heads: subGroup.heads.filter((head) => {
                if (selectedAccountId) {
                  return treeContainsSelectedHead([head], selectedAccountId)
                }

                return (
                  head.name.toLowerCase().includes(normalizedSearch) ||
                  head.path.some((segment) => segment.toLowerCase().includes(normalizedSearch))
                )
              }),
            }))
            .filter(
              (subGroup) =>
                subGroup.heads.length > 0 ||
                (!selectedAccountId && subGroup.name.toLowerCase().includes(normalizedSearch))
            ),
        }))
        .filter(
          (semiSubGroup) =>
            semiSubGroup.subGroups.length > 0 ||
            (!selectedAccountId && semiSubGroup.name.toLowerCase().includes(normalizedSearch))
        ),
    }))
    .filter(
      (group) =>
        group.semiSubGroups.length > 0 ||
        (!selectedAccountId && group.name.toLowerCase().includes(normalizedSearch))
    )
}

export function ChartOfAccountsManager({ clientId }: { clientId: string }) {
  const [view, setView] = useState<"tree" | "table">("tree")
  const [groupFilter, setGroupFilter] = useState<ChartGroupFilter>("all")
  const [search, setSearch] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const {
    tree,
    flatAccounts,
    groups,
    semiSubGroups,
    subGroups,
    isLoading,
    error,
  } = useChartOfAccounts(clientId)

  const normalizedSearch = search.trim().toLowerCase()
  const searchOptions = useMemo<AccountSearchOption[]>(
    () =>
      flatAccounts.map((account) => ({
        id: account.id,
        value: account.id,
        label: buildSearchLabel(account),
        displayLabel: account.name,
        path: account.path,
      })),
    [flatAccounts]
  )

  const filteredTree = useMemo(() => {
    if (!normalizedSearch && !selectedAccountId) {
      return tree.filter((group) => groupFilter === "all" || group.type === groupFilter)
    }

    return filterTreeBySearch(tree, groupFilter, normalizedSearch, selectedAccountId)
  }, [groupFilter, normalizedSearch, selectedAccountId, tree])

  const filteredFlatAccounts = useMemo(
    () =>
      flatAccounts.filter((account) => {
        const matchesGroup = groupFilter === "all" || account.groupType === groupFilter
        const matchesSearch = selectedAccountId
          ? account.id === selectedAccountId
          : !normalizedSearch ||
            account.name.toLowerCase().includes(normalizedSearch) ||
            account.subGroupName.toLowerCase().includes(normalizedSearch) ||
            account.semiSubGroupName.toLowerCase().includes(normalizedSearch) ||
            account.groupName.toLowerCase().includes(normalizedSearch) ||
            account.path.some((segment) => segment.toLowerCase().includes(normalizedSearch))
        return matchesGroup && matchesSearch
      }),
    [flatAccounts, groupFilter, normalizedSearch, selectedAccountId]
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-[1.5rem]" />
        <Skeleton className="h-[400px] rounded-[1.5rem]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 lg:text-[2rem]">
              Chart of Accounts
            </h2>
            <p className="mt-1.5 max-w-4xl text-sm leading-6 text-slate-500">
              Build your account structure step by step. Start from the main group, go deeper only when needed, and keep usable account heads at the final level.
            </p>
          </div>
          <AddAccountHeadDialog
            clientId={clientId}
            groups={groups}
            semiSubGroups={semiSubGroups}
            subGroups={subGroups}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_300px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Autocomplete
              options={searchOptions}
              value={selectedAccountId ?? undefined}
              onInputChange={(value) => {
                setSearch(value)
                setSelectedAccountId(null)
              }}
              onChange={(value) => {
                setSelectedAccountId(value || null)
                const selectedOption = searchOptions.find((option) => option.id === value)
                setSearch(selectedOption?.displayLabel ?? "")
              }}
              menuClassName="min-w-[min(34rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
              inputClassName="h-10 pl-10 text-sm"
              placeholder="Search by account name, category, or sub-category"
            />
          </div>

          <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as ChartGroupFilter)}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 text-sm">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="asset">Assets</SelectItem>
              <SelectItem value="liability">Liabilities</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <Button
              type="button"
              variant={view === "tree" ? "default" : "ghost"}
              className="h-[2.125rem] flex-1 rounded-lg text-sm"
              onClick={() => setView("tree")}
            >
              Tree View
            </Button>
            <Button
              type="button"
              variant={view === "table" ? "default" : "ghost"}
              className="h-[2.125rem] flex-1 rounded-lg text-sm"
              onClick={() => setView("table")}
            >
              List View
            </Button>
          </div>
        </div>
      </div>

      {view === "tree" ? (
        <AccountTree
          clientId={clientId}
          tree={filteredTree}
          groups={groups}
          semiSubGroups={semiSubGroups}
          subGroups={subGroups}
        />
      ) : (
        <AccountTable
          clientId={clientId}
          data={filteredFlatAccounts}
          groups={groups}
          semiSubGroups={semiSubGroups}
          subGroups={subGroups}
        />
      )}
    </div>
  )
}
