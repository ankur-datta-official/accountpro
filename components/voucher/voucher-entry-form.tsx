"use client"


import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  FileText,
  Loader2,
  PlusCircle,
  UploadCloud,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"

import {
  normalizePaymentModeName,
} from "@/lib/accounting/payment-modes"
import { normalizeVoucherLineAmounts } from "@/lib/accounting/voucher-entry-rules"
import {
  createVoucherAction,
  registerVoucherAttachmentsAction,
  updateVoucherAction,
  type CreateVoucherInput,
} from "@/lib/actions/vouchers"
import { formatVoucherDisplayNumber } from "@/lib/accounting/vouchers"
import { useChartOfAccounts } from "@/lib/hooks/useChartOfAccounts"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client"
import { VoucherLineRow, type VoucherLineFormValues } from "@/components/voucher/VoucherLineRow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const voucherFormSchema = z.object({
  clientId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  voucherNo: z.number().int().positive().optional(),
  voucherDate: z.string().min(1),
  voucherType: z.enum(["payment", "received", "journal", "contra", "bf", "bp", "br"]),
  showDescription: z.boolean(),
  description: z.string().optional(),
  showSupportingDocuments: z.boolean(),
  lines: z
    .array(
      z.object({
        accountsGroup: z
          .enum(["expense", "income", "asset", "liability"])
          .or(z.literal(""))
          .refine((value) => value !== "", "Accounts group is required."),
        accountHeadId: z.string().min(1, "Account head is required."),
        paymentModeId: z.string().optional(),
        paymentModeName: z.string().optional(),
        paymentModeType: z.enum(["bank", "cash", "mobile_banking", "other"]).optional(),
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
  accountHeadId?: string | null
}

type PaymentModeBalanceState = {
  currentBalance: number
  loading: boolean
  error?: string
}

type ResolvedPaymentModeSelection = PaymentModeOption & {
  lookupKey: string
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

const MAX_ATTACHMENT_COUNT = 10
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateOnly(value?: string | null) {
  if (!value || !DATE_ONLY_PATTERN.test(value)) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return value
}

function clampVoucherDateToFiscalYear({
  voucherDate,
  fiscalYearStartDate,
  fiscalYearEndDate,
}: {
  voucherDate: string
  fiscalYearStartDate?: string
  fiscalYearEndDate?: string
}) {
  const normalizedVoucherDate = normalizeDateOnly(voucherDate)
  const normalizedStartDate = normalizeDateOnly(fiscalYearStartDate)
  const normalizedEndDate = normalizeDateOnly(fiscalYearEndDate)

  if (!normalizedVoucherDate) {
    return normalizedStartDate ?? normalizedEndDate ?? format(new Date(), "yyyy-MM-dd")
  }

  if (!normalizedStartDate || !normalizedEndDate) {
    return normalizedVoucherDate
  }

  if (normalizedVoucherDate < normalizedStartDate) {
    return normalizedStartDate
  }

  if (normalizedVoucherDate > normalizedEndDate) {
    return normalizedEndDate
  }

  return normalizedVoucherDate
}

const defaultLine = (voucherType?: string): VoucherFormValues["lines"][number] => ({
  accountsGroup: voucherType === "contra" ? "asset" : "",
  accountHeadId: "",
  paymentModeId: "",
  paymentModeName: "",
  paymentModeType: undefined,
  debitAmount: 0,
  creditAmount: 0,
  description: "",
})

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function formatBalanceAmount(value: number) {
  return Number(value.toFixed(2)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function buildPaymentModeLookupKey(type?: string | null, name?: string | null) {
  const normalizedType = (type ?? "").trim()
  const normalizedName = normalizePaymentModeName(name ?? "").toLowerCase()

  if (!normalizedType || !normalizedName) {
    return null
  }

  return `${normalizedType}:${normalizedName}`
}

function resolveLinePaymentMode(
  line: VoucherFormValues["lines"][number],
  paymentModes: PaymentModeOption[]
): ResolvedPaymentModeSelection | null {
  if (line.paymentModeId) {
    const modeById = paymentModes.find((mode) => mode.id === line.paymentModeId) ?? null

    if (modeById) {
      return {
        ...modeById,
        lookupKey: modeById.id,
      }
    }
  }

  const lookupKey = buildPaymentModeLookupKey(line.paymentModeType, line.paymentModeName)

  if (!lookupKey) {
    return null
  }

  const modeByName = paymentModes.find(
    (mode) => buildPaymentModeLookupKey(mode.type, mode.name) === lookupKey
  )

  if (!modeByName) {
    return null
  }

  return {
    ...modeByName,
    lookupKey,
  }
}

function SectionToggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: boolean
  onChange: (nextValue: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      <span className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <button
        type="button"
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition",
          value ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900"
        )}
        onClick={() => onChange(true)}
        disabled={disabled}
      >
        Yes
      </button>
      <button
        type="button"
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition",
          !value ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900"
        )}
        onClick={() => onChange(false)}
        disabled={disabled}
      >
        No
      </button>
    </div>
  )
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")

  return cleaned || "document"
}

function buildAttachmentPath(clientId: string, voucherId: string, file: File) {
  const safeName = sanitizeFileName(file.name)
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `${clientId}/${voucherId}/${uniquePart}-${safeName}`
}

function buildFormValues({
  clientId,
  fiscalYearId,
  fiscalYearStartDate,
  fiscalYearEndDate,
  defaultVoucherNo,
  defaultVoucherNoByType,
  values,
}: {
  clientId: string
  fiscalYearId: string
  fiscalYearStartDate?: string
  fiscalYearEndDate?: string
  defaultVoucherNo: number
  defaultVoucherNoByType?: Partial<Record<VoucherFormValues["voucherType"], number>>
  values?: Partial<VoucherFormValues>
}): VoucherFormValues {
  const voucherType = values?.voucherType ?? "payment"
  const resolvedDefaultVoucherNo = values?.voucherNo ?? defaultVoucherNoByType?.[voucherType] ?? defaultVoucherNo

  const validatedLines = values?.lines?.length
    ? values.lines.map((line) =>
        line
          ? {
        accountsGroup: voucherType === "contra" ? "asset" : (line.accountsGroup ?? ""),
        accountHeadId: line.accountHeadId ?? "",
        paymentModeId: line.paymentModeId ?? "",
        paymentModeName: line.paymentModeName ?? "",
        paymentModeType: line.paymentModeType ?? undefined,
        debitAmount: Number(line.debitAmount ?? 0),
        creditAmount: Number(line.creditAmount ?? 0),
        description: line.description ?? ""
      }
          : defaultLine(voucherType)
      )
    : [defaultLine(voucherType)]

  return {
    clientId,
    fiscalYearId,
    voucherNo: resolvedDefaultVoucherNo,
    voucherDate: clampVoucherDateToFiscalYear({
      voucherDate: values?.voucherDate ?? format(new Date(), "yyyy-MM-dd"),
      fiscalYearStartDate,
      fiscalYearEndDate,
    }),
    voucherType: values?.voucherType ?? "payment",
    showDescription: values?.showDescription ?? Boolean(values?.description?.trim()),
    description: values?.description ?? "",
    showSupportingDocuments: values?.showSupportingDocuments ?? false,
    lines: validatedLines,
  }
}

export function VoucherEntryForm({
  mode = "create",
  voucherId,
  clientId,
  fiscalYearId,
  fiscalYearStartDate,
  fiscalYearEndDate,
  defaultVoucherNo,
  defaultVoucherNoByType,
  paymentModes,
  initialValues,
  disabled = false,
}: {
  mode?: "create" | "edit"
  voucherId?: string
  clientId: string
  fiscalYearId: string
  fiscalYearStartDate?: string
  fiscalYearEndDate?: string
  defaultVoucherNo: number
  defaultVoucherNoByType?: Partial<Record<VoucherFormValues["voucherType"], number>>
  paymentModes: PaymentModeOption[]
  initialValues?: Partial<VoucherFormValues>
  disabled?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftRestored, setDraftRestored] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const { flatAccounts, isLoading: accountsLoading } = useChartOfAccounts(clientId)
  const shouldUseDraft = mode === "create"
  const draftKey =
    mode === "edit"
      ? `accountpro:voucher-draft:${clientId}:${voucherId ?? fiscalYearId}:edit`
      : `accountpro:voucher-draft:${clientId}:${fiscalYearId}:create`

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: buildFormValues({
      clientId,
      fiscalYearId,
      fiscalYearStartDate,
      fiscalYearEndDate,
      defaultVoucherNo,
      defaultVoucherNoByType,
      values: initialValues,
    }),
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  })

  const values = form.watch()
  const voucherDisplayNo = formatVoucherDisplayNumber(values.voucherType, values.voucherNo ?? defaultVoucherNo)

  // When voucher type changes to contra, set accountsGroup to asset for all lines
  useEffect(() => {
    if (values.voucherType === "contra") {
      values.lines.forEach((line, index) => {
        form.setValue(`lines.${index}.accountsGroup`, "asset")
        // Also reset accountHeadId since contra only allows cash/bank
        form.setValue(`lines.${index}.accountHeadId`, "")
      })
    }
  }, [values.voucherType, values.lines, form])

  const showPaymentMode =
    values.voucherType === "payment" ||
    values.voucherType === "received"
  const visibleVoucherTypeOptions =
    mode === "create" ? voucherTypeOptions : [...voucherTypeOptions, ...legacyVoucherTypeOptions]

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

  // Only restore draft ONCE when component mounts
  useEffect(() => {
    if (typeof window === "undefined" || draftRestored) {
      return
    }

    if (!shouldUseDraft) {
      window.localStorage.removeItem(draftKey)
      setDraftRestored(true)
      return
    }

    const existingDraft = window.localStorage.getItem(draftKey)

    if (existingDraft) {
      form.reset(
        buildFormValues({
          clientId,
          fiscalYearId,
          fiscalYearStartDate,
          fiscalYearEndDate,
          defaultVoucherNo,
          defaultVoucherNoByType,
          values: JSON.parse(existingDraft) as VoucherFormValues,
        })
      )
    }

    setDraftRestored(true)
  }, [
    clientId,
    defaultVoucherNo,
    defaultVoucherNoByType,
    draftKey,
    draftRestored,
    fiscalYearEndDate,
    fiscalYearId,
    fiscalYearStartDate,
    form,
    initialValues,
    paymentModes,
    shouldUseDraft,
  ])

  // Auto-save draft
  useEffect(() => {
    if (!shouldUseDraft || !draftRestored || disabled) {
      return
    }

    const interval = window.setInterval(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()))
    }, 30000)

    return () => window.clearInterval(interval)
  }, [disabled, draftKey, draftRestored, form, shouldUseDraft])

  const selectedPaymentModes = useMemo(() => {
    const selectedModes = new Map<string, ResolvedPaymentModeSelection>()

    for (const line of values.lines) {
      const paymentMode = resolveLinePaymentMode(line, paymentModes)

      if (paymentMode?.accountHeadId) {
        selectedModes.set(paymentMode.lookupKey, paymentMode)
      }
    }

    return Array.from(selectedModes.values())
  }, [paymentModes, values.lines])

  const [paymentModeBalances, setPaymentModeBalances] = useState<Record<string, PaymentModeBalanceState>>({})

  useEffect(() => {
    if (!showPaymentMode || !selectedPaymentModes.length || !values.voucherDate) {
      setPaymentModeBalances({})
      return
    }

    const paymentModeLookupKeys = selectedPaymentModes.map((mode) => mode.lookupKey)

    setPaymentModeBalances((current) => {
      const nextState: Record<string, PaymentModeBalanceState> = {}

      for (const paymentMode of selectedPaymentModes) {
        nextState[paymentMode.lookupKey] = current[paymentMode.lookupKey]
          ? { ...current[paymentMode.lookupKey], loading: true, error: undefined }
          : { currentBalance: 0, loading: true }
      }

      return nextState
    })

    let isActive = true

    async function loadPaymentModeBalances() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.")
      }

      const params = new URLSearchParams({
        voucherDate: values.voucherDate,
        paymentModeIds: Array.from(new Set(selectedPaymentModes.map((mode) => mode.id))).join(","),
      })

      if (mode === "edit" && voucherId) {
        params.set("excludeVoucherId", voucherId)
      }

      const response = await fetch(`/api/clients/${clientId}/payment-mode-funding?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json().catch(() => ({ error: "Unable to load the latest fund balance right now." }))

      if (!isActive) {
        return
      }

      if (!response.ok) {
        const errorMessage = result.error ?? "Unable to load the latest fund balance right now."

        setPaymentModeBalances((current) => {
          const nextState = { ...current }

          for (const paymentModeLookupKey of paymentModeLookupKeys) {
            nextState[paymentModeLookupKey] = {
              currentBalance: current[paymentModeLookupKey]?.currentBalance ?? 0,
              loading: false,
              error: errorMessage,
            }
          }

          return nextState
        })
        return
      }

      setPaymentModeBalances(() => {
        const nextState: Record<string, PaymentModeBalanceState> = {}
        const fundingItems = Array.isArray(result.items) ? result.items : []
        const fundingByPaymentModeId = new Map<string, { currentBalance: number | null; isMapped: boolean }>(
          fundingItems.map((item: { paymentModeId: string; currentBalance: number | null; isMapped: boolean }) => [
            item.paymentModeId,
            {
              currentBalance: item.currentBalance,
              isMapped: item.isMapped,
            },
          ])
        )

        for (const paymentMode of selectedPaymentModes) {
          const funding = fundingByPaymentModeId.get(paymentMode.id)

          nextState[paymentMode.lookupKey] = {
            currentBalance: funding?.currentBalance ?? 0,
            loading: false,
            error: funding && !funding.isMapped
              ? "This payment mode is not linked to a fund account yet, so the live balance is unavailable."
              : undefined,
          }
        }

        return nextState
      })
    }

    loadPaymentModeBalances().catch((error) => {
      if (!isActive) {
        return
      }

      const errorMessage = error instanceof Error ? error.message : "Unable to load the latest fund balance right now."

      setPaymentModeBalances((current) => {
        const nextState = { ...current }

        for (const paymentModeLookupKey of paymentModeLookupKeys) {
          nextState[paymentModeLookupKey] = {
            currentBalance: current[paymentModeLookupKey]?.currentBalance ?? 0,
            loading: false,
            error: errorMessage,
          }
        }

        return nextState
      })
    })

    return () => {
      isActive = false
    }
  }, [clientId, mode, selectedPaymentModes, showPaymentMode, values.voucherDate, voucherId])

  const paymentModeFundingHints = useMemo(() => {
    if (!showPaymentMode) {
      return {}
    }

    const runningBalanceByLookupKey = new Map<string, number>()

    return values.lines.reduce<Record<number, { tone: "neutral" | "positive" | "warning"; text: string }>>(
      (acc, line, index) => {
        const selectedMode = resolveLinePaymentMode(line, paymentModes)

        if (!selectedMode) {
          return acc
        }

        if (!selectedMode?.accountHeadId) {
          acc[index] = {
            tone: "neutral",
            text: "This fund will show a live balance after its linked cash or bank account is available.",
          }
          return acc
        }

        const balanceState = paymentModeBalances[selectedMode.lookupKey]

        if (!balanceState) {
          return acc
        }

        if (balanceState.loading) {
          acc[index] = {
            tone: "neutral",
            text: `Checking latest ${selectedMode.name} balance...`,
          }
          return acc
        }

        if (balanceState.error) {
          acc[index] = {
            tone: "warning",
            text: balanceState.error,
          }
          return acc
        }

        const startingBalance = runningBalanceByLookupKey.has(selectedMode.lookupKey)
          ? runningBalanceByLookupKey.get(selectedMode.lookupKey) ?? 0
          : balanceState.currentBalance
        const currentBalance = Number(startingBalance.toFixed(2))
        const lineMovement = Number((Number(line.debitAmount || 0) - Number(line.creditAmount || 0)).toFixed(2))
        const projectedBalance = Number((currentBalance + lineMovement).toFixed(2))
        const hasEnteredAmount = Number(line.debitAmount || 0) > 0 || Number(line.creditAmount || 0) > 0
        runningBalanceByLookupKey.set(selectedMode.lookupKey, projectedBalance)

        if (projectedBalance < 0) {
          acc[index] = {
            tone: "warning",
            text: `Insufficient ${selectedMode.name} balance. Current fund is ${formatBalanceAmount(currentBalance)} and this line would update it to ${formatBalanceAmount(projectedBalance)}.`,
          }
          return acc
        }

        if (!hasEnteredAmount) {
          acc[index] = {
            tone: "neutral",
            text: `Current ${selectedMode.name} balance is ${formatBalanceAmount(currentBalance)}.`,
          }
          return acc
        }

        if (lineMovement < 0) {
          acc[index] = {
            tone: "neutral",
            text: `Current ${selectedMode.name} fund balance is ${formatBalanceAmount(currentBalance)}. After this payment, remaining balance will be ${formatBalanceAmount(projectedBalance)}.`,
          }
          return acc
        }

        acc[index] = {
          tone: "positive",
          text: `Current ${selectedMode.name} fund balance is ${formatBalanceAmount(currentBalance)}. After this receipt, updated balance will be ${formatBalanceAmount(projectedBalance)}.`,
        }
        return acc
      },
      {}
    )
  }, [paymentModeBalances, paymentModes, showPaymentMode, values.lines])

  const handleAddLine = () => {
    append(defaultLine(values.voucherType))
    if (shouldUseDraft) {
      window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()))
    }
  }

  const handleRemoveLine = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    } else {
      replace([defaultLine(values.voucherType)])
    }
    if (shouldUseDraft) {
      window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()))
    }
  }

  const handleAttachmentChange = (files: FileList | null) => {
    if (!files?.length) {
      return
    }

    const acceptedFiles: File[] = []

    for (const file of Array.from(files)) {
      if (selectedFiles.length + acceptedFiles.length >= MAX_ATTACHMENT_COUNT) {
        toast.error(`You can attach up to ${MAX_ATTACHMENT_COUNT} documents per voucher.`)
        break
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`${file.name} is larger than 15 MB.`)
        continue
      }

      if (file.type && !ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        toast.error(`${file.name} is not a supported document type.`)
        continue
      }

      acceptedFiles.push(file)
    }

    if (acceptedFiles.length) {
      setSelectedFiles((current) => [...current, ...acceptedFiles])
    }
  }

  const removeAttachment = (index: number) => {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleDescriptionToggle = (nextValue: boolean) => {
    form.setValue("showDescription", nextValue)

    if (!nextValue) {
      form.setValue("description", "")
    }
  }

  const handleSupportingDocumentsToggle = (nextValue: boolean) => {
    form.setValue("showSupportingDocuments", nextValue)

    if (!nextValue) {
      setSelectedFiles([])
    }
  }

  const uploadVoucherAttachments = async (voucherIdToAttach: string) => {
    if (!selectedFiles.length) {
      return { success: true as const }
    }

    const supabase = createBrowserSupabaseClient()
    const uploadedAttachments: {
      fileName: string
      filePath: string
      fileSize: number
      mimeType?: string
    }[] = []

    for (const file of selectedFiles) {
      const filePath = buildAttachmentPath(clientId, voucherIdToAttach, file)
      const { error } = await supabase.storage
        .from("voucher-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || undefined,
          upsert: false,
        })

      if (error) {
        if (uploadedAttachments.length) {
          await supabase.storage
            .from("voucher-documents")
            .remove(uploadedAttachments.map((attachment) => attachment.filePath))
        }

        return {
          success: false as const,
          error: error.message || `Unable to upload ${file.name}.`,
        }
      }

      uploadedAttachments.push({
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type || undefined,
      })
    }

    const result = await registerVoucherAttachmentsAction({
      clientId,
      voucherId: voucherIdToAttach,
      attachments: uploadedAttachments,
    })

    if (!result.success) {
      await supabase.storage
        .from("voucher-documents")
        .remove(uploadedAttachments.map((attachment) => attachment.filePath))
    }

    return result
  }

  const handleCreateAnother = () => {
    window.localStorage.removeItem(draftKey)
    setSelectedFiles([])
    const newVoucherType = "payment" // default to payment when creating another
    replace([defaultLine(newVoucherType)])
    form.reset(
      buildFormValues({
        clientId,
        fiscalYearId,
        defaultVoucherNo: (defaultVoucherNoByType?.payment ?? defaultVoucherNo) + 1,
        defaultVoucherNoByType,
        values: { voucherType: newVoucherType },
      })
    )
  }

  const onSubmit = (formValues: VoucherFormValues) => {
    const hasInvalidPaymentModeLine = formValues.lines.some((line) => {
      const normalizedPaymentModeName = normalizePaymentModeName(line.paymentModeName ?? "")

      if (!line.paymentModeType) {
        return false
      }

      if (line.paymentModeType === "other" && !normalizedPaymentModeName) {
        toast.error("Please enter the payment mode name for every selected entry line.")
        return true
      }

      if (
        (line.paymentModeType === "bank" || line.paymentModeType === "mobile_banking") &&
        !normalizedPaymentModeName
      ) {
        toast.error("Please choose the payment mode option for every selected entry line.")
        return true
      }

      return false
    })

    if (hasInvalidPaymentModeLine) {
      return
    }

    startTransition(async () => {
      const payload: CreateVoucherInput = {
        ...formValues,
        description: formValues.showDescription ? formValues.description || "" : "",
        lines: formValues.lines.map((line) => {
          const normalizedLine = normalizeVoucherLineAmounts({
            accountsGroup: line.accountsGroup as CreateVoucherInput["lines"][number]["accountsGroup"],
            accountHeadId: line.accountHeadId,
            paymentModeId: showPaymentMode ? line.paymentModeId || undefined : undefined,
            paymentModeName: showPaymentMode ? normalizePaymentModeName(line.paymentModeName ?? "") || undefined : undefined,
            paymentModeType: showPaymentMode ? line.paymentModeType : undefined,
            debitAmount: Number(line.debitAmount || 0),
            creditAmount: Number(line.creditAmount || 0),
            description: line.description || "",
          })

          return normalizedLine
        }),
      }

      let result: { success: boolean; voucherId?: string; voucherNo?: number; error?: string };
      try {
        result =
          mode === "edit" && voucherId
            ? await updateVoucherAction({ ...payload, voucherId })
            : await createVoucherAction(payload)

        if (!result?.success || !result.voucherId) {
          toast.error(result?.error || "Failed to save voucher")
          return
        }

        const attachmentResult = formValues.showSupportingDocuments
          ? await uploadVoucherAttachments(result.voucherId)
          : { success: true as const }

        if (!attachmentResult?.success) {
          toast.error(`Voucher saved, but documents were not attached. ${attachmentResult?.error || ""}`)
          return
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save voucher")
        return
      }

      window.localStorage.removeItem(draftKey)

      if (mode === "edit") {
        toast.success(`Voucher #${voucherDisplayNo} updated successfully.`)
        router.push(`/clients/${clientId}/vouchers/${result.voucherId}`)
        router.refresh()
        return
      }

      toast.success(`Voucher #${voucherDisplayNo} saved successfully.`, {
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {mode === "edit" ? "Edit Voucher" : "Add New Voucher"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Voucher No: {voucherDisplayNo}</span>
          <span className="text-slate-300">|</span>
          <span>{fields.length} line{fields.length === 1 ? "" : "s"}</span>
          <span className="text-slate-300">|</span>
          <span className={isBalanced ? "text-emerald-700" : "text-amber-700"}>
            {isBalanced ? "Balanced" : `Difference ${Math.abs(difference).toFixed(2)}`}
          </span>
        </div>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset disabled={disabled || isPending} className="space-y-6 disabled:opacity-70">
          <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-slate-950">Voucher Header</CardTitle>
              <CardDescription>Set the identity, date, and voucher type.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
              <label className="space-y-2 xl:col-span-2">
                <Label htmlFor="voucherNo">Voucher No</Label>
                <input type="hidden" {...form.register("voucherNo", { valueAsNumber: true })} />
                <Input
                  id="voucherNo"
                  type="text"
                  value={voucherDisplayNo}
                  readOnly
                  className="bg-slate-50 text-slate-700"
                />
              </label>

              <label className="space-y-2 xl:col-span-3">
                <Label htmlFor="voucherDate">Voucher Date</Label>
                <Input id="voucherDate" type="date" {...form.register("voucherDate")} />
              </label>

              <label className="space-y-2 xl:col-span-3">
                <Label>Voucher Type</Label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
                  value={values.voucherType}
                  onChange={(event) =>
                    {
                      const nextType = event.target.value as VoucherFormValues["voucherType"]
                      form.setValue("voucherType", nextType)
                      const nextDefaultVoucherNo = defaultVoucherNoByType?.[nextType] ?? defaultVoucherNo
                      form.setValue("voucherNo", nextDefaultVoucherNo)
                    }
                  }
                >
                  {visibleVoucherTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-xl text-slate-950">Entry Lines</CardTitle>
                <CardDescription>
                  Build the voucher with account-wise debit and credit entries{showPaymentMode ? ", including line-wise payment modes." : "."}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 px-4"
                onClick={handleAddLine}
                disabled={disabled}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const line = values.lines[index] ?? defaultLine()
                return (
                  <VoucherLineRow
                    key={field.id}
                    index={index}
                    line={line}
                    accounts={flatAccounts}
                    voucherType={values.voucherType}
                    paymentModes={paymentModes}
                    paymentModeFundingHint={paymentModeFundingHints[index]}
                    onRemove={() => handleRemoveLine(index)}
                    onAddLine={handleAddLine}
                    register={(name) => form.register(name)}
                    setValue={(name, value) => form.setValue(name, value)}
                    disabled={disabled}
                  />
                )
              })}

              {accountsLoading ? <p className="text-sm text-slate-500">Loading chart of accounts...</p> : null}
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl text-slate-950">Narration / Description</CardTitle>
                  <CardDescription>Add a concise explanation so the voucher remains audit-friendly.</CardDescription>
                </div>
                <SectionToggle
                  label="Include"
                  value={values.showDescription}
                  onChange={handleDescriptionToggle}
                  disabled={disabled || isPending}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  id="description"
                  rows={8}
                  {...form.register("description")}
                  disabled={disabled || isPending || !values.showDescription}
                  className={cn("min-h-[120px] rounded-xl", !values.showDescription && "opacity-50")}
                  placeholder="Write a clear voucher narration..."
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl text-slate-950">Supporting Documents</CardTitle>
                  <CardDescription>Attach evidence only when it adds clarity or audit support.</CardDescription>
                </div>
                <SectionToggle
                  label="Attach"
                  value={values.showSupportingDocuments}
                  onChange={handleSupportingDocumentsToggle}
                  disabled={disabled || isPending}
                />
              </CardHeader>
              <CardContent className={cn("space-y-3", !values.showSupportingDocuments && "opacity-50")}>
                <label
                  htmlFor="voucherAttachments"
                  className={cn(
                    "flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center transition",
                    "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
                    !values.showSupportingDocuments && "pointer-events-none"
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <span className="mt-3 text-sm font-semibold text-slate-950">Drop or choose documents</span>
                  <span className="mt-1 text-xs text-slate-500">
                    PDF, images, Word, Excel, or text files up to 15 MB each
                  </span>
                  <input
                    id="voucherAttachments"
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(event) => {
                      handleAttachmentChange(event.target.files)
                      event.target.value = ""
                    }}
                    disabled={disabled || isPending || !values.showSupportingDocuments}
                  />
                </label>

                <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                  You can add up to {MAX_ATTACHMENT_COUNT} files. Useful examples: supplier invoice, bank advice,
                  receipt, approval note, or supporting worksheet.
                </div>

                {selectedFiles.length ? (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-950">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => removeAttachment(index)}
                          disabled={disabled || isPending || !values.showSupportingDocuments}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                    No files selected yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </fieldset>

        <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur">
          <div className="flex justify-end">
            <div className="w-full sm:w-auto">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl px-6 text-base font-semibold shadow-sm sm:min-w-[180px] sm:w-auto"
                disabled={isPending || disabled}
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {mode === "edit" ? "Update Voucher" : "Save Voucher"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
