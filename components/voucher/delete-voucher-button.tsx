"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteVoucherAction } from "@/lib/actions/vouchers"
import { Button } from "@/components/ui/button"

export function DeleteVoucherButton({
  clientId,
  voucherId,
  voucherDisplayNo,
  variant = "ghost",
  className,
  onDeleted,
}: {
  clientId: string
  voucherId: string
  voucherDisplayNo: string
  variant?: "ghost" | "outline" | "destructive"
  className?: string
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`Delete voucher #${voucherDisplayNo}? This cannot be undone.`)) {
          return
        }

        startTransition(async () => {
          try {
            const result = await deleteVoucherAction({ clientId, voucherId })

            if (!result?.success) {
              toast.error(result?.error || "Failed to delete voucher")
              return
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete voucher")
            return
          }

          toast.success(`Voucher #${voucherDisplayNo} deleted.`)

          if (onDeleted) {
            onDeleted()
            return
          }

          router.push(`/clients/${clientId}/vouchers`)
          router.refresh()
        })
      }}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="mr-2 h-4 w-4" />
      )}
      Delete
    </Button>
  )
}
