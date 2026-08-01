"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import type { AccountGroupType } from "@/lib/types"
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

type HierarchyCreateLevel = "group" | "category" | "sub-category"

const levelConfig: Record<
  HierarchyCreateLevel,
  {
    title: string
    description: string
    fieldLabel: string
    fieldPlaceholder: string
    buttonLabel: string
    successLabel: string
  }
> = {
  group: {
    title: "Add account group",
    description: "Create a new account group under this main account type.",
    fieldLabel: "Account Group Name",
    fieldPlaceholder: "e.g. General & Administrative Expenses",
    buttonLabel: "Add Account Group",
    successLabel: "Account group created.",
  },
  category: {
    title: "Add category",
    description: "Create a new category inside this account group.",
    fieldLabel: "Category Name",
    fieldPlaceholder: "e.g. Office Expenses",
    buttonLabel: "Add Category",
    successLabel: "Category created.",
  },
  "sub-category": {
    title: "Add sub-category",
    description: "Create a new sub-category inside this category.",
    fieldLabel: "Sub-Category Name",
    fieldPlaceholder: "e.g. Electricity Bills",
    buttonLabel: "Add Sub-Category",
    successLabel: "Sub-category created.",
  },
}

export function AddHierarchyItemDialog({
  clientId,
  level,
  groupType,
  groupId,
  semiSubGroupId,
  className,
}: {
  clientId: string
  level: HierarchyCreateLevel
  groupType?: AccountGroupType
  groupId?: string
  semiSubGroupId?: string
  className?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const config = levelConfig[level]

  const handleSubmit = async () => {
    const trimmedName = name.trim()

    if (trimmedName.length < 2) {
      toast.error("Name must be at least 2 characters.")
      return
    }

    setSubmitting(true)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setSubmitting(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/chart-of-accounts/hierarchy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        level,
        name: trimmedName,
        groupType,
        groupId,
        semiSubGroupId,
      }),
    })

    const result = await response.json().catch(() => ({ error: "Unable to save hierarchy item." }))
    setSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save hierarchy item.")
      return
    }

    toast.success(config.successLabel)
    await queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", clientId] })
    setName("")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setName("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <PlusCircle className="h-3.5 w-3.5" />
          {config.buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`hierarchy-name-${level}`}>{config.fieldLabel}</Label>
          <Input
            id={`hierarchy-name-${level}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={config.fieldPlaceholder}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </div>

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {config.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
