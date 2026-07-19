"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

type HierarchyLevel = "group" | "category" | "sub-category"

const hierarchyLabel: Record<HierarchyLevel, string> = {
  group: "account group",
  category: "category",
  "sub-category": "sub-category",
}

export function DeleteHierarchyButton({
  clientId,
  itemId,
  itemName,
  level,
  className,
}: {
  clientId: string
  itemId: string
  itemName: string
  level: HierarchyLevel
  className?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const label = hierarchyLabel[level]

    if (!window.confirm(`Delete ${label} "${itemName}"? This only works when it has no items inside.`)) {
      return
    }

    setLoading(true)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setLoading(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(
      `/api/clients/${clientId}/chart-of-accounts/hierarchy/${level}/${itemId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    )

    const result = await response.json().catch(() => ({ error: `Unable to delete ${label}.` }))
    setLoading(false)

    if (!response.ok) {
      toast.error(result.error ?? `Unable to delete ${label}.`)
      return
    }

    toast.success(`${itemName} deleted.`)
    await queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", clientId] })
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? "h-8 px-2 whitespace-nowrap text-destructive hover:text-destructive"}
      disabled={loading}
      onClick={handleDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </Button>
  )
}
