"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PencilLine, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { createClient } from "@/lib/supabase/client"
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

const paymentModeSchema = z.object({
  name: z.string().min(2, "Name is required."),
  type: z.enum(["bank", "cash", "mobile_banking", "other"]),
  account_no: z.string().optional(),
  is_active: z.boolean(),
})

type PaymentModeFormValues = z.infer<typeof paymentModeSchema>

const typeOptions = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "Mobile Banking" },
  { value: "other", label: "Other" },
] as const

export function PaymentModeForm({
  clientId,
  mode,
}: {
  clientId: string
  mode?: {
    id: string
    name: string
    type: "bank" | "cash" | "mobile_banking" | "other"
    account_no: string | null
    is_active: boolean | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<PaymentModeFormValues>({
    resolver: zodResolver(paymentModeSchema),
    defaultValues: {
      name: mode?.name ?? "",
      type: mode?.type ?? "bank",
      account_no: mode?.account_no ?? "",
      is_active: mode?.is_active ?? true,
    },
  })

  useEffect(() => {
    if (!open) {
      form.reset({
        name: mode?.name ?? "",
        type: mode?.type ?? "bank",
        account_no: mode?.account_no ?? "",
        is_active: mode?.is_active ?? true,
      })
    }
  }, [form, mode, open])

  const onSubmit = async (values: PaymentModeFormValues) => {
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

    const url = mode
      ? `/api/clients/${clientId}/payment-modes/${mode.id}`
      : `/api/clients/${clientId}/payment-modes`

    const response = await fetch(url, {
      method: mode ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(values),
    })

    const result = await response.json().catch(() => ({ error: "Unable to save payment mode." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save payment mode.")
      return
    }

    toast.success(mode ? "Payment mode updated." : "Payment mode created.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-slate-600">
            <PencilLine className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button className="h-11 rounded-xl px-5">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Payment Mode
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="rounded-3xl border-slate-200 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode ? "Edit payment mode" : "Add payment mode"}</DialogTitle>
          <DialogDescription>
            Save the bank, cash account, or custom collection mode used by this client.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Mutual Bank" {...form.register("name")} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(value) =>
                form.setValue("type", value as PaymentModeFormValues["type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment mode type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_no">Account Number</Label>
            <Input id="account_no" placeholder="Optional account number" {...form.register("account_no")} />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.watch("is_active")}
              onChange={(event) => form.setValue("is_active", event.target.checked)}
            />
            Keep this payment mode active
          </label>

          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" className="rounded-xl border-slate-200" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Payment Mode
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
