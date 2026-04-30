"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { clientTypeOptions, fiscalYearMonths } from "@/lib/accounting/clients"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const clientSchema = z.object({
  name: z.string().min(2, "Client name is required."),
  type: z.enum(["company", "individual", "partnership", "ngo"]),
  trade_name: z.string().optional(),
  tin: z.string().optional(),
  bin: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  fiscal_year_start: z.number().int().min(1).max(12),
})

type ClientFormValues = z.infer<typeof clientSchema>

export function ClientForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      type: "company",
      trade_name: "",
      tin: "",
      bin: "",
      address: "",
      phone: "",
      email: "",
      fiscal_year_start: 7,
    },
  })

  const onSubmit = async (values: ClientFormValues) => {
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

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(values),
    })

    const result = await response.json().catch(() => ({ error: "Unable to create client." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to create client.")
      return
    }

    toast.success("Client created successfully.")
    router.replace(`/clients/${result.clientId}`)
    router.refresh()
  }

  return (
    <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Add New Client</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          Create a client workspace, initialize its active fiscal year, and provision default
          payment modes in one step.
        </p>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input id="name" placeholder="Acme Trading Ltd." {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              defaultValue={String(form.getValues("type"))}
              onValueChange={(value) => form.setValue("type", value as ClientFormValues["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client type" />
              </SelectTrigger>
              <SelectContent>
                {clientTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.type ? (
              <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trade_name">Trade Name</Label>
            <Input id="trade_name" placeholder="Optional trade name" {...form.register("trade_name")} />
          </div>

          <div className="space-y-2">
            <Label>Fiscal Year Start Month</Label>
            <Select
              defaultValue={String(form.getValues("fiscal_year_start"))}
              onValueChange={(value) => form.setValue("fiscal_year_start", Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a month" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearMonths.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tin">TIN</Label>
            <Input id="tin" placeholder="Tax identification number" {...form.register("tin")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bin">BIN</Label>
            <Input id="bin" placeholder="Business identification number" {...form.register("bin")} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="+880 1XXXXXXXXX" {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="client@example.com" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            rows={4}
            placeholder="Client mailing or registered address"
            {...form.register("address")}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-slate-200"
            onClick={() => router.push("/clients")}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-11 rounded-xl px-6" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Client
          </Button>
        </div>
      </form>
    </Card>
  )
}
