"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Loader2, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"

import {
  BANGLADESH_BANK_OPTIONS,
  BANGLADESH_MOBILE_BANKING_OPTIONS,
  PAYMENT_MODE_GROUPS,
  normalizePaymentModeName,
} from "@/lib/accounting/payment-modes"
import { normalizeVoucherLineAmounts } from "@/lib/accounting/voucher-entry-rules"
import {
  createVoucherAction,
  updateVoucherAction,
  type CreateVoucherInput,
} from "@/lib/actions/vouchers"
import { useChartOfAccounts } from "@/lib/hooks/useChartOfAccounts"
import type { PaymentModeType } from "@/lib/types"
import { VoucherLineRow, type VoucherLineFormValues } from "@/components/voucher/VoucherLineRow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const voucherFormSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  voucherNo: z.number().int().positive().optional(),
  voucherDate: z.string().min(1),
  voucherType: z.enum(["payment", "received", "journal", "contra", "bf", "bp", "br"]),
  paymentModeId: z.string().optional(),
  paymentModeName: z.string().optional(),
  paymentModeType: z.enum(["bank", "cash", "mobile_banking", "other"]).optional(),
  description: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountsGroup: z
          .enum(["expense", "income", "asset", "liability"])
          .or(z.literal(""))
          .refine((value) => value !== "", "Accounts group is required."),
        accountHeadId: z.string().min(1, "Account head is required."),
        debitAmount: z.number().min(0),
        creditAmount: z.number().min(0),
        description: z.string().optional(),
      })
    )
    .min(1),
})

type VoucherFormValues = z.input<typeof voucherFormSchema> & VoucherLineFormValues

type PaymentModeOption = {
  id: string
  name: string
  type: string | null
}

const voucherTypeOptions = [
  { value: "payment", label: "Payment" },
  { value: "received", label: "Received" },
  { value: "journal", label: "Journal" },
  { value: "contra", label: "Contra" },
]

const legacyVoucherTypeOptions = [
  { value: "bf", label: "B/F" },
  { value: "bp", label: "B/P" },
  { value: "br", label: "B/R" },
] as const

const defaultLine = (): VoucherFormValues["lines"][number] => ({
  accountsGroup: "",
  accountHeadId: "",
  debitAmount: 0,
  creditAmount: 0,
  description: "",
})

function getDefaultCashMode(paymentModes: PaymentModeOption[]) {
  return (
    paymentModes.find((mode) => mode.type === "cash" && normalizePaymentModeName(mode.name).toLowerCase() === "cash") ??
    paymentModes.find((mode) => mode.type === "cash") ??
    null
  )
}

function buildFormValues({
  clientId,
  fiscalYearId,
  defaultVoucherNo,
  paymentModes,
  values,
}: {
  clientId: string
  fiscalYearId: string
  defaultVoucherNo: number
  paymentModes: PaymentModeOption[]
  values?: Partial<VoucherFormValues>
}): VoucherFormValues {
  const defaultCashMode = getDefaultCashMode(paymentModes)
  const selectedPaymentMode = values?.paymentModeId
    ? paymentModes.find((mode) => mode.id === values.paymentModeId)
    : null

  const paymentModeType = (selectedPaymentMode?.type ??
    values?.paymentModeType ??
    defaultCashMode?.type ??
    "cash") as PaymentModeType
  const normalizedDraftPaymentModeName = normalizePaymentModeName(values?.paymentModeName ?? "")
  const paymentModeName =
    selectedPaymentMode?.name ??
    (normalizedDraftPaymentModeName || defaultCashMode?.name || "Cash")

  return {
    clientId,
    fiscalYearId,
    voucherNo: values?.voucherNo ?? defaultVoucherNo,
    voucherDate: values?.voucherDate ?? format(new Date(), "yyyy-MM-dd"),
    voucherType: values?.voucherType ?? "payment",
    paymentModeId: selectedPaymentMode?.id ?? (paymentModeType === "cash" ? defaultCashMode?.id ?? "" : ""),
    paymentModeName,
    paymentModeType,
    description: values?.description ?? "",
    lines: values?.lines?.length ? values.lines : [defaultLine()],
  }
}

export function VoucherEntryForm({
  mode = "create",
  voucherId,
  clientId,
  clientName,
  fiscalYearId,
  fiscalYearLabel,
  defaultVoucherNo,
  paymentModes,
  initialValues,
  disabled = false,
  lastUpdated,
}: {
  mode?: "create" | "edit"
  voucherId?: string
  clientId: string
  clientName: string
  fiscalYearId: string
  fiscalYearLabel: string
  defaultVoucherNo: number
  paymentModes: PaymentModeOption[]
  initialValues?: Partial<VoucherFormValues>
  disabled?: boolean
  lastUpdated?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftRestored, setDraftRestored] = useState(false)
  const { flatAccounts, isLoading: accountsLoading } = useChartOfAccounts(clientId)
  const draftKey =
    mode === "edit"
      ? `accountpro:voucher-draft:${clientId}:${voucherId ?? fiscalYearId}:edit`
      : `accountpro:voucher-draft:${clientId}:${fiscalYearId}:create`

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: buildFormValues({
      clientId,
      fiscalYearId,
      defaultVoucherNo,
      paymentModes,
      values: initialValues,
    }),
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  const values = form.watch()
  const showPaymentMode =
    values.voucherType === "payment" ||
    values.voucherType === "received" ||
    values.voucherType === "journal"
  const visibleVoucherTypeOptions =
    mode === "create" ? voucherTypeOptions : [...voucherTypeOptions, ...legacyVoucherTypeOptions]

  const paymentModesByType = useMemo(
    () => ({
      cash: paymentModes.filter((mode) => mode.type === "cash"),
      mobile_banking: paymentModes.filter((mode) => mode.type === "mobile_banking"),
      bank: paymentModes.filter((mode) => mode.type === "bank"),
      other: paymentModes.filter((mode) => mode.type === "other"),
    }),
    [paymentModes]
  )

  const selectedExistingPaymentMode = values.paymentModeId
    ? paymentModes.find((mode) => mode.id === values.paymentModeId) ?? null
    : null
  const selectedPaymentModeGroup = (selectedExistingPaymentMode?.type ??
    values.paymentModeType ??
    "cash") as PaymentModeType

  const bankOptions = useMemo(() => {
    const names = new Set([
      ...BANGLADESH_BANK_OPTIONS,
      ...paymentModesByType.bank.map((mode) => mode.name),
    ])
    return Array.from(names).sort((left, right) => left.localeCompare(right))
  }, [paymentModesByType.bank])

  const mobileBankingOptions = useMemo(() => {
    const names = new Set([
      ...BANGLADESH_MOBILE_BANKING_OPTIONS,
      ...paymentModesByType.mobile_banking.map((mode) => mode.name),
    ])
    return Array.from(names).sort((left, right) => left.localeCompare(right))
  }, [paymentModesByType.mobile_banking])

  const totalDebit = useMemo(
    () => values.lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0),
    [values.lines]
  )
  const totalCredit = useMemo(
    () => values.lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0),
    [values.lines]
  )
  const difference = Number((totalDebit - totalCredit).toFixed(2))
  const isBalanced = difference === 0

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const existingDraft = window.localStorage.getItem(draftKey)

    if (existingDraft) {
      form.reset(
        buildFormValues({
          clientId,
          fiscalYearId,
          defaultVoucherNo,
          paymentModes,
          values: JSON.parse(existingDraft) as VoucherFormValues,
        })
      )
    } else {
      form.reset(
        buildFormValues({
          clientId,
          fiscalYearId,
          defaultVoucherNo,
          paymentModes,
          values: initialValues,
        })
      )
    }

    setDraftRestored(true)
  }, [clientId, defaultVoucherNo, draftKey, fiscalYearId, form, initialValues, paymentModes])

  useEffect(() => {
    if (!draftRestored || disabled) {
      return
    }

    const interval = window.setInterval(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()))
    }, 30000)

    return () => window.clearInterval(interval)
  }, [disabled, draftKey, draftRestored, form])

  const handleAddLine = () => append(defaultLine())

  const handleCreateAnother = () => {
    window.localStorage.removeItem(draftKey)
    replace([defaultLine()])
    form.reset(
      buildFormValues({
        clientId,
        fiscalYearId,
        defaultVoucherNo: defaultVoucherNo + 1,
        paymentModes,
      })
    )
  }

  const handlePaymentModeGroupChange = (nextGroup: PaymentModeType) => {
    if (nextGroup === "cash") {
      const cashMode = getDefaultCashMode(paymentModes)
      form.setValue("paymentModeId", cashMode?.id ?? "")
      form.setValue("paymentModeName", cashMode?.name ?? "Cash")
      form.setValue("paymentModeType", "cash")
      return
    }

    form.setValue("paymentModeId", "")
    form.setValue("paymentModeName", "")
    form.setValue("paymentModeType", nextGroup)
  }

  const handleNamedPaymentModeChange = (name: string, type: Extract<PaymentModeType, "bank" | "mobile_banking">) => {
    const existingMode = paymentModes.find(
      (mode) => mode.type === type && normalizePaymentModeName(mode.name).toLowerCase() === name.toLowerCase()
    )

    form.setValue("paymentModeId", existingMode?.id ?? "")
    form.setValue("paymentModeName", name)
    form.setValue("paymentModeType", type)
  }

  const onSubmit = (formValues: VoucherFormValues) => {
    const normalizedPaymentModeName = normalizePaymentModeName(formValues.paymentModeName ?? "")

    if (showPaymentMode) {
      if (selectedPaymentModeGroup === "other" && !normalizedPaymentModeName) {
        toast.error("Please enter an other payment mode.")
        return
      }

      if (
        (selectedPaymentModeGroup === "bank" || selectedPaymentModeGroup === "mobile_banking") &&
        !normalizedPaymentModeName
      ) {
        toast.error("Please choose a payment mode option.")
        return
      }
    }

    startTransition(async () => {
      const payload: CreateVoucherInput = {
        ...formValues,
        paymentModeId: showPaymentMode ? formValues.paymentModeId : undefined,
        paymentModeName: showPaymentMode ? normalizedPaymentModeName : undefined,
        paymentModeType: showPaymentMode ? selectedPaymentModeGroup : undefined,
        description: formValues.description || "",
        lines: formValues.lines.map((line) => {
          const normalizedLine = normalizeVoucherLineAmounts({
            accountsGroup: line.accountsGroup as CreateVoucherInput["lines"][number]["accountsGroup"],
            accountHeadId: line.accountHeadId,
            debitAmount: Number(line.debitAmount || 0),
            creditAmount: Number(line.creditAmount || 0),
            description: line.description || "",
          })

          return normalizedLine
        }),
      }

      const result =
        mode === "edit" && voucherId
          ? await updateVoucherAction({ ...payload, voucherId })
          : await createVoucherAction(payload)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      window.localStorage.removeItem(draftKey)

      if (mode === "edit") {
        toast.success(`Voucher #${result.voucherNo} updated successfully.`)
        router.push(`/clients/${clientId}/vouchers/${result.voucherId}`)
        router.refresh()
        return
      }

      toast.success(`Voucher #${result.voucherNo} saved successfully.`, {
        action: {
          label: "View Voucher",
          onClick: () => router.push(`/clients/${clientId}/vouchers/${result.voucherId}`),
        },
        cancel: {
          label: "Add Another Voucher",
          onClick: handleCreateAnother,
        },
      })

      handleCreateAnother()
      router.refresh()
    })
  }

  const namedPaymentModeValue =
    selectedExistingPaymentMode?.name || (selectedPaymentModeGroup === "other" ? "" : values.paymentModeName || "")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            {mode === "edit" ? "Edit Voucher" : "New Voucher"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {mode === "edit"
              ? `Update voucher details for ${clientName} in fiscal year ${fiscalYearLabel}.`
              : `Record a new voucher for ${clientName} in fiscal year ${fiscalYearLabel}.`}
          </p>
          {lastUpdated ? (
            <p className="mt-2 text-sm text-slate-500">Last updated: {lastUpdated}</p>
          ) : null}
        </div>
        <Button asChild variant="outline" className="rounded-xl border-slate-200">
          <Link href={`/clients/${clientId}/vouchers`}>Back to vouchers</Link>
        </Button>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset disabled={disabled || isPending} className="space-y-6 disabled:opacity-70">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Voucher Header</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voucherNo">Voucher No</Label>
                <Input
                  id="voucherNo"
                  type="number"
                  {...form.register("voucherNo", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucherDate">Voucher Date</Label>
                <Input id="voucherDate" type="date" {...form.register("voucherDate")} />
              </div>
              <div className="space-y-2">
                <Label>Voucher Type</Label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                  value={values.voucherType}
                  onChange={(event) =>
                    form.setValue("voucherType", event.target.value as VoucherFormValues["voucherType"])
                  }
                >
                  {visibleVoucherTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {showPaymentMode ? (
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                      <select
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                        value={selectedPaymentModeGroup}
                        onChange={(event) => handlePaymentModeGroupChange(event.target.value as PaymentModeType)}
                      >
                        {PAYMENT_MODE_GROUPS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {selectedPaymentModeGroup === "cash" ? (
                        <Input value={values.paymentModeName || "Cash"} readOnly />
                      ) : null}

                      {selectedPaymentModeGroup === "mobile_banking" ? (
                        <select
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                          value={namedPaymentModeValue}
                          onChange={(event) =>
                            handleNamedPaymentModeChange(event.target.value, "mobile_banking")
                          }
                        >
                          <option value="">Select mobile banking option</option>
                          {mobileBankingOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      {selectedPaymentModeGroup === "bank" ? (
                        <select
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
                          value={namedPaymentModeValue}
                          onChange={(event) => handleNamedPaymentModeChange(event.target.value, "bank")}
                        >
                          <option value="">Select bank</option>
                          {bankOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      {selectedPaymentModeGroup === "other" ? (
                        <Input
                          placeholder="Enter other payment mode"
                          value={values.paymentModeName ?? ""}
                          onChange={(event) => {
                            form.setValue("paymentModeId", "")
                            form.setValue("paymentModeName", event.target.value)
                            form.setValue("paymentModeType", "other")
                          }}
                        />
                      ) : null}
                    </div>

                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-xl text-slate-950">Entry Lines</CardTitle>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200"
                onClick={handleAddLine}
                disabled={disabled}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <VoucherLineRow
                  key={field.id}
                  index={index}
                  line={values.lines[index]}
                  accounts={flatAccounts}
                  onRemove={() => (fields.length > 1 ? remove(index) : replace([defaultLine()]))}
                  onAddLine={handleAddLine}
                  register={(name) => form.register(name)}
                  setValue={(name, value) => form.setValue(name, value)}
                  disabled={disabled}
                />
              ))}
              {accountsLoading ? (
                <p className="text-sm text-slate-500">Loading chart of accounts...</p>
              ) : null}

              <div className="space-y-2 pt-2">
                <Label htmlFor="description">Narration / Description</Label>
                <Textarea id="description" rows={4} {...form.register("description")} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Amount Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Debit</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{totalDebit.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Credit</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{totalCredit.toFixed(2)}</p>
              </div>
              <div
                className={`rounded-2xl p-4 ${
                  isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}
              >
                <p className="text-sm font-medium">
                  {isBalanced
                    ? "Balanced"
                    : `Unbalanced (diff: ${Math.abs(difference).toFixed(2)})`}
                </p>
                <p className="mt-2 text-sm">
                  {showPaymentMode && !isBalanced
                    ? "Payment and Received vouchers will auto-balance with the selected payment mode."
                    : "Journal, Contra, and opening vouchers must balance before saving."}
                </p>
              </div>
            </CardContent>
          </Card>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" className="h-11 rounded-xl px-6" disabled={isPending || disabled}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "edit" ? "Update Voucher" : "Save Voucher"}
          </Button>
        </div>
      </form>
    </div>
  )
}
