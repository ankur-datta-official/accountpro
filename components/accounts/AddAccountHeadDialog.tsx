"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PencilLine, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
  accountHeadName: z.string().min(2, "Account head name is required."),
  openingBalance: z.number().default(0),
  balanceType: z.enum(["debit", "credit"]),
  newGroupName: z.string().optional(),
  newGroupType: z.enum(["expense", "income", "asset", "liability"]).optional(),
  newSemiSubGroupName: z.string().optional(),
  newSubGroupName: z.string().optional(),
})

type AccountHeadFormValues = z.input<typeof addAccountHeadSchema>

export function AddAccountHeadDialog({
  clientId,
  groups,
  semiSubGroups,
  subGroups,
  defaultGroupId,
  defaultSemiSubGroupId,
  defaultSubGroupId,
  head,
}: {
  clientId: string
  groups: AccountGroup[]
  semiSubGroups: AccountSemiSubGroup[]
  subGroups: AccountSubGroup[]
  defaultGroupId?: string
  defaultSemiSubGroupId?: string
  defaultSubGroupId?: string
  head?: AccountHead
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createGroupInline, setCreateGroupInline] = useState(false)
  const [createSemiInline, setCreateSemiInline] = useState(false)
  const [createSubInline, setCreateSubInline] = useState(false)

  const form = useForm<AccountHeadFormValues>({
    resolver: zodResolver(addAccountHeadSchema),
    defaultValues: {
      accountGroupId: defaultGroupId,
      semiSubGroupId: defaultSemiSubGroupId,
      subGroupId: defaultSubGroupId,
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
    defaultSemiSubGroupId,
    defaultSubGroupId,
    form,
    head,
    open,
  ])

  const selectedGroupId = form.watch("accountGroupId")
  const selectedSemiSubGroupId = form.watch("semiSubGroupId")
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  const filteredSemiSubGroups = useMemo(
    () => semiSubGroups.filter((semiSubGroup) => semiSubGroup.group_id === selectedGroupId),
    [selectedGroupId, semiSubGroups]
  )

  const filteredSubGroups = useMemo(
    () => subGroups.filter((subGroup) => subGroup.semi_sub_id === selectedSemiSubGroupId),
    [selectedSemiSubGroupId, subGroups]
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
          <Button type="button" variant="outline" size="sm" className="rounded-xl border-slate-200">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Account Head
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-slate-200 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{head ? "Edit account head" : "Add account head"}</DialogTitle>
          <DialogDescription>
            Choose the posting hierarchy for this account head. You can also create a new group path inline if needed.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          {!head ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Account Group</Label>
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
                    <Input placeholder="New group name" {...form.register("newGroupName")} />
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
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account group" />
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
                  <Label>Semi-Sub Group</Label>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      setCreateSemiInline((value) => !value)
                      form.setValue("semiSubGroupId", undefined)
                    }}
                  >
                    {createSemiInline ? "Use existing semi-sub group" : "Create new semi-sub group"}
                  </button>
                </div>
                {createSemiInline ? (
                  <Input placeholder="New semi-sub group name" {...form.register("newSemiSubGroupName")} />
                ) : (
                  <Select
                    value={form.watch("semiSubGroupId")}
                    onValueChange={(value) => {
                      form.setValue("semiSubGroupId", value)
                      form.setValue("subGroupId", undefined)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semi-sub group" />
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
                  <Label>Sub-Group</Label>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      setCreateSubInline((value) => !value)
                      form.setValue("subGroupId", undefined)
                    }}
                  >
                    {createSubInline ? "Use existing sub-group" : "Create new sub-group"}
                  </button>
                </div>
                {createSubInline ? (
                  <Input placeholder="New sub-group name" {...form.register("newSubGroupName")} />
                ) : (
                  <Select
                    value={form.watch("subGroupId")}
                    onValueChange={(value) => form.setValue("subGroupId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-group" />
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
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="accountHeadName">Account Head Name</Label>
            <Input id="accountHeadName" {...form.register("accountHeadName")} />
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

          <DialogFooter className="gap-3">
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
