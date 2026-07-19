"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PencilLine, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useChartOfAccounts, type ChartTreeHead } from "@/lib/hooks/useChartOfAccounts"
import { createClient } from "@/lib/supabase/client"
import type { AccountGroup, AccountHead, AccountSemiSubGroup, AccountSubGroup } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const addAccountHeadSchema = z.object({
  accountGroupId: z.string().optional(),
  semiSubGroupId: z.string().optional(),
  subGroupId: z.string().optional(),
  parentAccountHeadId: z.string().optional(),
  nodeType: z.enum(["branch", "posting"]).default("posting"),
  accountHeadName: z.string().min(2, "Account head name is required."),
  openingBalance: z.coerce.number().default(0),
  balanceType: z.enum(["debit", "credit"]).default("debit"),
  newGroupName: z.string().optional(),
  newGroupType: z.enum(["expense", "income", "asset", "liability"]).optional(),
  newSemiSubGroupName: z.string().optional(),
  newSubGroupName: z.string().optional(),
})

type AccountHeadFormValues = z.input<typeof addAccountHeadSchema>

type ParentOption = {
  id: string
  label: string
}

function normalizeHierarchyName(value: string) {
  return value.trim().toLowerCase()
}

function flattenHeadOptions(heads: ChartTreeHead[], prefix: string[] = []): ParentOption[] {
  return heads.flatMap((head) => {
    const nextPath = [...prefix, head.name]

    return [
      {
        id: head.id,
        label: nextPath.join(" > "),
      },
      ...flattenHeadOptions(head.children, nextPath),
    ]
  })
}

export function AddAccountHeadDialog({
  clientId,
  groups,
  semiSubGroups,
  subGroups,
  defaultGroupId,
  defaultSemiSubGroupId,
  defaultSubGroupId,
  defaultParentAccountHeadId,
  head,
}: {
  clientId: string
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
  defaultGroupId?: string
  defaultSemiSubGroupId?: string
  defaultSubGroupId?: string
  defaultParentAccountHeadId?: string | null
  head?: AccountHead
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createGroupInline, setCreateGroupInline] = useState(false)
  const [createSemiInline, setCreateSemiInline] = useState(false)
  const [createSubInline, setCreateSubInline] = useState(false)
  const { tree } = useChartOfAccounts(clientId)

  const form = useForm<AccountHeadFormValues>({
    resolver: zodResolver(addAccountHeadSchema),
    defaultValues: {
      accountGroupId: defaultGroupId,
      semiSubGroupId: defaultSemiSubGroupId,
      subGroupId: defaultSubGroupId,
      parentAccountHeadId: defaultParentAccountHeadId ?? undefined,
      nodeType: "posting",
      accountHeadName: head?.name ?? "",
      openingBalance: Number(head?.opening_balance ?? 0),
      balanceType: (head?.balance_type ?? "debit") as "debit" | "credit",
      newGroupName: "",
      newSemiSubGroupName: "",
      newSubGroupName: "",
    },
  })

  useEffect(() => {
    if (!open) {
      setCreateGroupInline(false)
      setCreateSemiInline(false)
      setCreateSubInline(false)
      form.reset({
        accountGroupId: defaultGroupId,
        semiSubGroupId: defaultSemiSubGroupId,
        subGroupId: defaultSubGroupId,
        parentAccountHeadId: defaultParentAccountHeadId ?? undefined,
        nodeType: "posting",
        accountHeadName: head?.name ?? "",
        openingBalance: Number(head?.opening_balance ?? 0),
        balanceType: (head?.balance_type ?? "debit") as "debit" | "credit",
        newGroupName: "",
        newSemiSubGroupName: "",
        newSubGroupName: "",
      })
    }
  }, [
    defaultGroupId,
    defaultParentAccountHeadId,
    defaultSemiSubGroupId,
    defaultSubGroupId,
    form,
    head,
    open,
  ])

  const selectedGroupId = form.watch("accountGroupId")
  const selectedSemiSubGroupId = form.watch("semiSubGroupId")
  const selectedSubGroupId = form.watch("subGroupId")
  const selectedParentAccountHeadId = form.watch("parentAccountHeadId")
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null
  const selectedSemiSubGroup =
    semiSubGroups.find((semiSubGroup) => semiSubGroup.id === selectedSemiSubGroupId) ?? null

  const filteredSemiSubGroups = useMemo(
    () => semiSubGroups.filter((semiSubGroup) => semiSubGroup.group_id === selectedGroupId),
    [selectedGroupId, semiSubGroups]
  )

  const filteredSubGroups = useMemo(
    () => subGroups.filter((subGroup) => subGroup.semi_sub_id === selectedSemiSubGroupId),
    [selectedSemiSubGroupId, subGroups]
  )

  const duplicateNamedSubGroup = useMemo(() => {
    if (!selectedSemiSubGroup) {
      return null
    }

    return (
      filteredSubGroups.find(
        (subGroup) =>
          normalizeHierarchyName(subGroup.name) === normalizeHierarchyName(selectedSemiSubGroup.name)
      ) ?? null
    )
  }, [filteredSubGroups, selectedSemiSubGroup])

  const shouldAutoUseDuplicateSubGroup =
    !createSubInline &&
    Boolean(selectedSemiSubGroup) &&
    filteredSubGroups.length === 1 &&
    Boolean(duplicateNamedSubGroup)

  useEffect(() => {
    if (!shouldAutoUseDuplicateSubGroup || !duplicateNamedSubGroup) {
      return
    }

    if (form.getValues("subGroupId") !== duplicateNamedSubGroup.id) {
      form.setValue("subGroupId", duplicateNamedSubGroup.id)
    }
  }, [duplicateNamedSubGroup, form, shouldAutoUseDuplicateSubGroup])

  const selectedTreeSubGroup = useMemo(() => {
    for (const group of tree) {
      for (const semiSubGroup of group.semiSubGroups) {
        const match = semiSubGroup.subGroups.find((subGroup) => subGroup.id === selectedSubGroupId)
        if (match) {
          return match
        }
      }
    }

    return null
  }, [selectedSubGroupId, tree])

  const parentOptions = useMemo(
    () =>
      flattenHeadOptions(selectedTreeSubGroup?.heads ?? []).filter((option) =>
        head ? option.id !== head.id : true
      ),
    [head, selectedTreeSubGroup]
  )

  const onSubmit = async (values: AccountHeadFormValues) => {
    setIsSubmitting(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setIsSubmitting(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const payload = {
      accountGroupId: createGroupInline ? undefined : values.accountGroupId,
      semiSubGroupId: createSemiInline ? undefined : values.semiSubGroupId,
      subGroupId: createSubInline ? undefined : values.subGroupId,
      parentAccountHeadId: head ? undefined : values.parentAccountHeadId || null,
      nodeType: "posting",
      accountHeadName: values.accountHeadName,
      openingBalance: values.openingBalance ?? 0,
      balanceType: values.balanceType,
      newGroupName: createGroupInline ? values.newGroupName : undefined,
      newGroupType: createGroupInline ? values.newGroupType || selectedGroup?.type || "expense" : undefined,
      newSemiSubGroupName: createSemiInline ? values.newSemiSubGroupName : undefined,
      newSubGroupName: createSubInline ? values.newSubGroupName : undefined,
      is_active: head?.is_active ?? true,
    }

    const response = await fetch(
      head
        ? `/api/clients/${clientId}/chart-of-accounts/account-heads/${head.id}`
        : `/api/clients/${clientId}/chart-of-accounts`,
      {
        method: head ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    )

    const result = await response.json().catch(() => ({ error: "Unable to save account head." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save account head.")
      return
    }

    toast.success(head ? "Account head updated." : "Account head created.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {head ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-slate-600">
            <PencilLine className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl border-slate-200 px-3 whitespace-nowrap">
            <PlusCircle className="mr-2 h-4 w-4" />
            {defaultParentAccountHeadId ? "Add Child Head" : "Add Account Head"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-6 pb-1 pt-5">
          <DialogTitle>{head ? "Edit account head" : "Add account head"}</DialogTitle>
          <DialogDescription>Choose the level, then save the posting-ready account head.</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            {!head ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Main Account Group</Label>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setCreateGroupInline((value) => !value)
                        form.setValue("accountGroupId", undefined)
                      }}
                    >
                      {createGroupInline ? "Use existing group" : "Create new group"}
                    </button>
                  </div>
                  {createGroupInline ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input placeholder="e.g. General & Administrative Expenses" {...form.register("newGroupName")} />
                      <Select
                        value={form.watch("newGroupType")}
                        onValueChange={(value) =>
                          form.setValue("newGroupType", value as AccountHeadFormValues["newGroupType"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Group type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expenses</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="asset">Assets</SelectItem>
                          <SelectItem value="liability">Liabilities</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Select
                      value={form.watch("accountGroupId")}
                      onValueChange={(value) => {
                        form.setValue("accountGroupId", value)
                        form.setValue("semiSubGroupId", undefined)
                        form.setValue("subGroupId", undefined)
                        form.setValue("parentAccountHeadId", undefined)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the top-level group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Category</Label>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setCreateSemiInline((value) => !value)
                        form.setValue("semiSubGroupId", undefined)
                      }}
                    >
                      {createSemiInline ? "Use existing category" : "Create new category"}
                    </button>
                  </div>
                  {createSemiInline ? (
                    <Input placeholder="e.g. Office Expenses" {...form.register("newSemiSubGroupName")} />
                  ) : (
                    <Select
                      value={form.watch("semiSubGroupId")}
                      onValueChange={(value) => {
                        form.setValue("semiSubGroupId", value)
                        form.setValue("subGroupId", undefined)
                        form.setValue("parentAccountHeadId", undefined)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the next category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSemiSubGroups.map((semiSubGroup) => (
                          <SelectItem key={semiSubGroup.id} value={semiSubGroup.id}>
                            {semiSubGroup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sub-Category</Label>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setCreateSubInline((value) => !value)
                        form.setValue("subGroupId", undefined)
                      }}
                    >
                      {createSubInline ? "Use existing sub-category" : "Create new sub-category"}
                    </button>
                  </div>
                  {createSubInline ? (
                    <Input placeholder="e.g. Electricity Bills" {...form.register("newSubGroupName")} />
                  ) : shouldAutoUseDuplicateSubGroup && duplicateNamedSubGroup ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{duplicateNamedSubGroup.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        This sub-category is already the same as the selected category, so it has been selected automatically.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={form.watch("subGroupId")}
                      onValueChange={(value) => {
                        form.setValue("subGroupId", value)
                        form.setValue("parentAccountHeadId", undefined)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the section where this belongs" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubGroups.map((subGroup) => (
                          <SelectItem key={subGroup.id} value={subGroup.id}>
                            {subGroup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

            <div className="space-y-2">
              {selectedSubGroupId && parentOptions.length > 0 ? (
                <div className="space-y-2">
                  <Label>Parent Account Head (Optional)</Label>
                  <Select
                    value={selectedParentAccountHeadId ?? "__root__"}
                    onValueChange={(value) =>
                      form.setValue("parentAccountHeadId", value === "__root__" ? undefined : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Create at the current sub-category level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__root__">Create at the current sub-category level</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

                <div className="space-y-2">
                  <Label htmlFor="accountHeadName">Account Head Name</Label>
                  <Input
                    id="accountHeadName"
                    {...form.register("accountHeadName")}
                    placeholder="e.g. Electricity Bill"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openingBalance">Opening Balance</Label>
                    <Input id="openingBalance" type="number" step="0.01" {...form.register("openingBalance")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Balance Type</Label>
                    <Select
                      value={form.watch("balanceType")}
                      onValueChange={(value) =>
                        form.setValue("balanceType", value as AccountHeadFormValues["balanceType"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select balance type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <Button type="button" variant="outline" className="rounded-xl border-slate-200" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Account Head
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
