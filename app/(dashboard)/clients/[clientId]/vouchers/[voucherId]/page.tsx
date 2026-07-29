import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, FileText } from "lucide-react"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

import {
  buildVoucherTypeSerialMap,
  formatVoucherDisplayNumber,
  getVoucherTypeBadgeClass,
  getVoucherTypeLabel,
  isAutoBalanceEntry,
  summarizePaymentModeNames,
} from "@/lib/accounting/vouchers"
import { VoucherDetailActions } from "@/components/voucher/voucher-detail-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type VoucherEntryRecord = Database["public"]["Tables"]["voucher_entries"]["Row"]
type FiscalYearRecord = Database["public"]["Tables"]["fiscal_years"]["Row"]
type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]
type AccountHeadRecord = Database["public"]["Tables"]["account_heads"]["Row"]
type VoucherAttachmentRecord = Database["public"]["Tables"]["voucher_attachments"]["Row"]

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default async function VoucherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; voucherId: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { client } = await getClientRouteContext({ clientId: resolvedParams.clientId })

  if (!client) {
    notFound()
  }

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", resolvedParams.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!voucher) {
    notFound()
  }

  const { data: fiscalYearVouchers } = voucher.fiscal_year_id
    ? await supabase
        .from("vouchers")
        .select("id,client_id,fiscal_year_id,voucher_date,voucher_no,voucher_type,created_at")
        .eq("client_id", client.id)
        .eq("fiscal_year_id", voucher.fiscal_year_id)
        .or("is_posted.eq.true,is_posted.is.null")
    : { data: [] }

  const voucherTypeSerialById = buildVoucherTypeSerialMap(
    (fiscalYearVouchers ?? []) as Array<
      Pick<
        Database["public"]["Tables"]["vouchers"]["Row"],
        "id" | "client_id" | "fiscal_year_id" | "voucher_date" | "voucher_no" | "voucher_type" | "created_at"
      >
    >
  )
  const voucherDisplayNo = formatVoucherDisplayNumber(
    voucher.voucher_type,
    voucherTypeSerialById.get(voucher.id) ?? voucher.voucher_no
  )

  const [{ data: entries }, { data: fiscalYear }, { data: paymentMode }, { data: attachments }] = await Promise.all([
    supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id),
    supabase.from("fiscal_years").select("*").eq("id", voucher.fiscal_year_id ?? "").maybeSingle(),
    voucher.payment_mode_id
      ? supabase.from("payment_modes").select("*").eq("id", voucher.payment_mode_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("voucher_attachments").select("*").eq("voucher_id", voucher.id).order("created_at"),
  ])

  const entryRows = (entries ?? []) as VoucherEntryRecord[]
  const fiscalYearRow = fiscalYear as FiscalYearRecord | null
  const paymentModeRow = paymentMode as PaymentModeRecord | null
  const attachmentRows = (attachments ?? []) as VoucherAttachmentRecord[]
  const accountHeadIds = entryRows.map((entry) => entry.account_head_id).filter(Boolean) as string[]
  const linePaymentModeIds = Array.from(
    new Set(entryRows.map((entry) => entry.payment_mode_id).filter(Boolean) as string[])
  )

  const [{ data: accountHeads }, { data: linePaymentModes }] = await Promise.all([
    accountHeadIds.length
      ? supabase.from("account_heads").select("*").in("id", accountHeadIds)
      : Promise.resolve({ data: [] as AccountHeadRecord[] }),
    linePaymentModeIds.length
      ? supabase.from("payment_modes").select("*").in("id", linePaymentModeIds)
      : Promise.resolve({ data: [] as PaymentModeRecord[] }),
  ])

  const accountHeadMap = new Map((accountHeads ?? []).map((head: AccountHeadRecord) => [head.id, head.name]))
  const linePaymentModeMap = new Map(
    (linePaymentModes ?? []).map((mode: PaymentModeRecord) => [mode.id, mode.name])
  )
  const totalDebit = entryRows.reduce((sum, entry) => sum + Number(entry.debit ?? 0), 0)
  const totalCredit = entryRows.reduce((sum, entry) => sum + Number(entry.credit ?? 0), 0)
  const visibleEntries = entryRows.filter((entry) => !isAutoBalanceEntry(entry.description))
  const printLines = (visibleEntries.length ? visibleEntries : entryRows).map((entry) => ({
    id: entry.id,
    accountHeadName: accountHeadMap.get(entry.account_head_id ?? "") ?? "Unknown",
    accountsGroup: entry.accounts_group,
    debit: Number(entry.debit ?? 0),
    credit: Number(entry.credit ?? 0),
    description: entry.description ?? null,
  }))
  const paymentModeSummary = summarizePaymentModeNames([
    ...entryRows.map((entry) => linePaymentModeMap.get(entry.payment_mode_id ?? "") ?? null),
    paymentModeRow?.name ?? null,
  ])
  const primaryAccountHeadName = printLines[0]?.accountHeadName ?? client.name
  const autoPrint = resolvedSearchParams?.print === "1"
  const attachmentItems = await Promise.all(
    attachmentRows.map(async (attachment) => {
      const { data } = await supabase.storage
        .from("voucher-documents")
        .createSignedUrl(attachment.file_path, 60 * 60)

      return {
        ...attachment,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Voucher #{voucherDisplayNo}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {format(new Date(voucher.voucher_date), "dd MMM yyyy")} - {getVoucherTypeLabel(voucher.voucher_type)}
            {voucher.month_label ? ` - ${voucher.month_label}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-xl border-slate-200">
            <Link href={`/clients/${client.id}/vouchers/new?fiscalYear=${voucher.fiscal_year_id ?? ""}`}>
              Add Another Voucher
            </Link>
          </Button>
          <VoucherDetailActions
            clientId={client.id}
            voucherId={voucher.id}
            voucherDisplayNo={voucherDisplayNo}
            companyName={client.name}
            voucherType={voucher.voucher_type}
            voucherDate={voucher.voucher_date}
            paymentModeName={paymentModeSummary}
            description={voucher.description ?? null}
            accountHeadName={primaryAccountHeadName}
            lines={printLines}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            showDescription={voucher.show_description ?? true}
            showSupportingDocuments={voucher.show_supporting_documents ?? true}
            attachments={attachmentItems.map((attachment) => ({
              id: attachment.id,
              fileName: attachment.file_name,
              fileSize: Number(attachment.file_size),
            }))}
            autoPrint={autoPrint}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] print:hidden">
        <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Voucher Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Voucher type</p>
              <Badge className={`mt-2 rounded-full ${getVoucherTypeBadgeClass(voucher.voucher_type)}`}>
                {getVoucherTypeLabel(voucher.voucher_type)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-slate-500">Payment mode</p>
              <p className="mt-1 font-medium text-slate-950">{paymentModeSummary ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Fiscal year</p>
              <p className="mt-1 font-medium text-slate-950">{fiscalYearRow?.label ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Last updated</p>
              <p className="mt-1 font-medium text-slate-950">
                {voucher.updated_at ? format(new Date(voucher.updated_at), "dd MMM yyyy, h:mm a") : "-"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-slate-500">Narration</p>
              <p className="mt-1 font-medium text-slate-900">{voucher.description || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Amount Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Debit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{currency(totalDebit)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Credit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{currency(totalCredit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {attachmentItems.length ? (
        <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm print:hidden">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Supporting Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {attachmentItems.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950">{attachment.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(Number(attachment.file_size))}
                      {attachment.mime_type ? ` - ${attachment.mime_type}` : ""}
                    </p>
                  </div>
                </div>
                {attachment.signedUrl ? (
                  <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-200">
                    <a href={attachment.signedUrl} target="_blank" rel="noreferrer">
                      Open
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl text-slate-950">Voucher Entries</CardTitle>
          <div className="text-sm text-slate-500">
            {entryRows.length} line{entryRows.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-2xl border border-slate-200 p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-slate-50">
                <TableHead className="w-16">#</TableHead>
                <TableHead>Account Head</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryRows.map((entry, index) => (
                <TableRow key={entry.id} className="border-slate-100">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium text-slate-950">
                    {accountHeadMap.get(entry.account_head_id ?? "") ?? "Unknown"}
                  </TableCell>
                  <TableCell className="capitalize text-slate-600">{entry.accounts_group ?? "-"}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-950">
                    {Number(entry.debit ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-950">
                    {Number(entry.credit ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {isAutoBalanceEntry(entry.description) ? "Auto-balancing entry" : entry.description || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
