"use client"

import { useMemo, useState } from "react"
import { addYears, format, parseISO, subDays } from "date-fns"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { generateFiscalYearLabel } from "@/lib/accounting/fiscal-year"
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

const fiscalYearSchema = z.object({
  label: z.string().min(2, "Year label is required."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
})

type FiscalYearFormValues = z.infer<typeof fiscalYearSchema>

export function FiscalYearForm({
  clientId,
  existingYears,
  defaultStartDate,
}: {
  clientId: string
  existingYears: Array<{ id: string; start_date: string; end_date: string }>
  defaultStartDate: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const defaultEndDate = useMemo(
    () => format(subDays(addYears(parseISO(defaultStartDate), 1), 1), "yyyy-MM-dd"),
    [defaultStartDate]
  )

  const form = useForm<FiscalYearFormValues>({
    resolver: zodResolver(fiscalYearSchema),
    defaultValues: {
      label: generateFiscalYearLabel(parseISO(defaultStartDate)),
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    },
  })

  const handleStartDateChange = (value: string) => {
    form.setValue("startDate", value)
    const start = parseISO(value)
    const end = subDays(addYears(start, 1), 1)
    form.setValue("label", generateFiscalYearLabel(start))
    form.setValue("endDate", format(end, "yyyy-MM-dd"))
  }

  const onSubmit = async (values: FiscalYearFormValues) => {
    const newStart = parseISO(values.startDate).getTime()
    const newEnd = parseISO(values.endDate).getTime()

    const overlaps = existingYears.some((year) => {
      const currentStart = parseISO(year.start_date).getTime()
      const currentEnd = parseISO(year.end_date).getTime()
      return newStart <= currentEnd && newEnd >= currentStart
    })

    if (overlaps) {
      toast.error("This fiscal year overlaps with an existing period.")
      return
    }

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

    const response = await fetch(`/api/clients/${clientId}/fiscal-years`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(values),
    })

    const result = await response.json().catch(() => ({ error: "Unable to create fiscal year." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to create fiscal year.")
      return
    }

    toast.success("Fiscal year created.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-xl px-5">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Fiscal Year
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-slate-200 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a fiscal year</DialogTitle>
          <DialogDescription>
            Add a new reporting period for this client. The end date is auto-calculated as one year minus one day from the start.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="label">Year Label</Label>
            <Input id="label" {...form.register("label")} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.watch("startDate")}
                onChange={(event) => handleStartDateChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...form.register("endDate")} />
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" className="rounded-xl border-slate-200" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Fiscal Year
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
