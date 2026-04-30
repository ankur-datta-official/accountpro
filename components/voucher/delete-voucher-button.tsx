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
  voucherNo,
  variant = "ghost",
  className,
  onDeleted,
}: {
  clientId: string
  voucherId: string
  voucherNo: number
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
        if (!window.confirm(`Delete voucher #${voucherNo}? This cannot be undone.`)) {
          return
        }

        startTransition(async () => {
          const result = await deleteVoucherAction({ clientId, voucherId })

          if (!result.success) {
            toast.error(result.error)
            return
          }

          toast.success(`Voucher #${voucherNo} deleted.`)

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
