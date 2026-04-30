"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVITABLE_ROLES, formatRole } from "@/lib/team"
import { createClient } from "@/lib/supabase/client"
import type { OrganizationMemberRole } from "@/lib/types"

type EditRoleDialogProps = {
  memberId: string
  currentRole: OrganizationMemberRole
  memberName: string
  disabled?: boolean
  onUpdated: () => Promise<void>
}

export function EditRoleDialog({
  memberId,
  currentRole,
  memberName,
  disabled = false,
  onUpdated,
}: EditRoleDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<"admin" | "accountant" | "viewer">(
    currentRole === "owner" ? "admin" : currentRole
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    setIsSubmitting(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setIsSubmitting(false)
      toast.error("Your session has expired. Please sign in again.")
      return
    }

    const response = await fetch(`/api/team/${memberId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ role: selectedRole }),
    })

    const result = await response.json().catch(() => ({ error: "Unable to update role." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to update role.")
      return
    }

    toast.success(`Role updated to ${formatRole(selectedRole)}.`)
    setOpen(false)
    await onUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-slate-600" disabled={disabled}>
          Edit Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>Update permissions for {memberName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as typeof selectedRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSave}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
