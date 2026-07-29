import Link from "next/link"
import { format } from "date-fns"
import { notFound } from "next/navigation"

import {
  buildVoucherTypeSerialMap,
  formatVoucherDisplayNumber,
  isAutoBalanceEntry,
  summarizePaymentModeNames,
} from "@/lib/accounting/vouchers"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { VoucherPrintView, type VoucherPrintAttachment, type VoucherPrintLine } from "@/components/voucher/VoucherPrintView"
import { SelectedVouchersPrintActions } from "@/components/voucher/selected-vouchers-print-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard, PageHeader } from "@/components/ui/page-shell"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

export const dynamic = "force-dynamic"

type VoucherRecord = Database["public"]["Tables"]["vouchers"]["Row"]
type VoucherEntryRecord = Database["public"]["Tables"]["voucher_entries"]["Row"]
type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]
type AccountHeadRecord = Database["public"]["Tables"]["account_heads"]["Row"]
type VoucherAttachmentRecord = Database["public"]["Tables"]["voucher_attachments"]["Row"]

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export default async function SelectedVoucherPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ ids?: string; auto?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()
  const { client } = await getClientRouteContext({ clientId: resolvedParams.clientId })

  if (!client) {
    notFound()
  }

  const selectedIds = dedupe(
    (resolvedSearchParams.ids ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )
  const autoPrint = resolvedSearchParams.auto === "1"

  if (!selectedIds.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-10">
        <Card className="w-full rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print Selected</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">No vouchers selected</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Go back to the voucher register, select one or more vouchers, then open the print page again.
              </p>
            </div>
            <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
              <Link href={`/clients/${client.id}/vouchers`}>Back to Register</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("*")
    .eq("client_id", client.id)
    .in("id", selectedIds)
    .or("is_posted.eq.true,is_posted.is.null")

  const voucherOrder = new Map(selectedIds.map((id, index) => [id, index]))
  const orderedVouchers = [...((vouchers ?? []) as VoucherRecord[])].sort((left, right) => {
    return (voucherOrder.get(left.id) ?? Number.POSITIVE_INFINITY) - (voucherOrder.get(right.id) ?? Number.POSITIVE_INFINITY)
  })

  if (!orderedVouchers.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-10">
        <Card className="w-full rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print Selected</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Selected vouchers were not found</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                The selected vouchers may have been removed or are outside the current organization context.
              </p>
            </div>
            <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
              <Link href={`/clients/${client.id}/vouchers`}>Back to Register</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const serialFiscalYearIds = dedupe(
    orderedVouchers.map((voucher) => voucher.fiscal_year_id ?? "").filter(Boolean)
  )
  const { data: serialSource } = serialFiscalYearIds.length
    ? await supabase
        .from("vouchers")
        .select("id,client_id,fiscal_year_id,voucher_date,voucher_no,voucher_type,created_at")
        .eq("client_id", client.id)
        .in("fiscal_year_id", serialFiscalYearIds)
        .or("is_posted.eq.true,is_posted.is.null")
    : { data: [] as Pick<
        VoucherRecord,
        "id" | "client_id" | "fiscal_year_id" | "voucher_date" | "voucher_no" | "voucher_type" | "created_at"
      >[] }

  const serialMap = buildVoucherTypeSerialMap(serialSource ?? [])

  const selectedVoucherDetails = await Promise.all(
    orderedVouchers.map(async (voucher) => {
      const [{ data: entries }, { data: paymentMode }, { data: attachments }] = await Promise.all([
        supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id),
        voucher.payment_mode_id
          ? supabase.from("payment_modes").select("*").eq("id", voucher.payment_mode_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("voucher_attachments").select("*").eq("voucher_id", voucher.id).order("created_at"),
      ])

      const entryRows = (entries ?? []) as VoucherEntryRecord[]
      const accountHeadIds = dedupe(entryRows.map((entry) => entry.account_head_id ?? "").filter(Boolean))
      const linePaymentModeIds = dedupe(entryRows.map((entry) => entry.payment_mode_id ?? "").filter(Boolean))
      const { data: accountHeads } = accountHeadIds.length
        ? await supabase.from("account_heads").select("*").in("id", accountHeadIds)
        : { data: [] as AccountHeadRecord[] }
      const { data: linePaymentModes } = linePaymentModeIds.length
        ? await supabase.from("payment_modes").select("*").in("id", linePaymentModeIds)
        : { data: [] as PaymentModeRecord[] }

      const accountHeadMap = new Map<string, string>(
        ((accountHeads ?? []) as AccountHeadRecord[]).map((head) => [head.id, head.name])
      )
      const linePaymentModeMap = new Map<string, string>(
        ((linePaymentModes ?? []) as PaymentModeRecord[]).map((mode) => [mode.id, mode.name])
      )
      const visibleEntries = entryRows.filter((entry) => !isAutoBalanceEntry(entry.description))
      const lines = (visibleEntries.length ? visibleEntries : entryRows).map((entry) => ({
        id: entry.id,
        accountHeadName: accountHeadMap.get(entry.account_head_id ?? "") ?? "Unknown",
        accountsGroup: entry.accounts_group,
        debit: Number(entry.debit ?? 0),
        credit: Number(entry.credit ?? 0),
        description: entry.description ?? null,
      })) as VoucherPrintLine[]

      const signedAttachments = ((attachments ?? []) as VoucherAttachmentRecord[]).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.file_name,
        fileSize: Number(attachment.file_size),
      })) satisfies VoucherPrintAttachment[]

      const totalDebit = entryRows.reduce((sum, entry) => sum + Number(entry.debit ?? 0), 0)
      const totalCredit = entryRows.reduce((sum, entry) => sum + Number(entry.credit ?? 0), 0)
      const voucherDisplayNo = formatVoucherDisplayNumber(
        voucher.voucher_type,
        serialMap.get(voucher.id) ?? voucher.voucher_no
      )

      return {
        voucher,
        paymentModeName: summarizePaymentModeNames([
          ...entryRows.map((entry) => linePaymentModeMap.get(entry.payment_mode_id ?? "") ?? null),
          (paymentMode as PaymentModeRecord | null)?.name ?? null,
        ]),
        lines,
        totalDebit,
        totalCredit,
        voucherDisplayNo,
        accountHeadName: lines[0]?.accountHeadName ?? client.name,
        attachments: signedAttachments,
      }
    })
  )

  const selectedCount = selectedVoucherDetails.length
  const totalDebit = selectedVoucherDetails.reduce((sum, item) => sum + item.totalDebit, 0)
  const totalCredit = selectedVoucherDetails.reduce((sum, item) => sum + item.totalCredit, 0)
  const voucherDates = selectedVoucherDetails.map((item) => new Date(item.voucher.voucher_date).getTime())
  const earliestDate = voucherDates.length ? new Date(Math.min(...voucherDates)) : null
  const latestDate = voucherDates.length ? new Date(Math.max(...voucherDates)) : null

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Voucher register"
          title="Print Selected Vouchers"
          description={`Preview and print ${selectedCount} selected voucher${selectedCount === 1 ? "" : "s"} for ${client.name}.`}
          actions={
            <SelectedVouchersPrintActions
              backHref={`/clients/${client.id}/vouchers`}
              autoPrint={autoPrint}
            />
          }
        >
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {selectedCount} selected
            </Badge>
            <span className="text-slate-300">-</span>
            <span>{earliestDate && latestDate ? `${format(earliestDate, "dd MMM yyyy")} to ${format(latestDate, "dd MMM yyyy")}` : "Selected vouchers only"}</span>
          </div>
        </PageHeader>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <MetricCard label="Selected vouchers" value={selectedCount} detail="Only the checked vouchers will be printed." />
          <MetricCard label="Total debit" value={formatMoney(totalDebit)} detail="Combined debit value for the selected set." />
          <MetricCard label="Total credit" value={formatMoney(totalCredit)} detail="Combined credit value for the selected set." />
        </div>

        <Card className="mt-6 rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Print preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              This preview keeps the same clean A4 layout used by the single voucher print view, so the final output
              stays consistent and professional.
            </p>
            <p>
              Use <span className="font-medium text-slate-900">Print Page</span> to open the browser print dialog. If
              your browser blocks popups from the register, the selected vouchers will open in this tab instead.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="hidden print:block">
        <section className="mb-6 rounded-[1.5rem] border border-slate-900 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">DKLedger</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
                Selected Voucher Print
              </h1>
              <p className="mt-2 text-sm text-slate-600">{client.name}</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-5 py-4 text-right text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">Prepared on</p>
              <p className="mt-1 text-lg font-semibold">{format(new Date(), "dd MMM yyyy")}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Selected vouchers</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{selectedCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Total debit</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(totalDebit)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Total credit</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(totalCredit)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6 print:space-y-0">
        {selectedVoucherDetails.map((item, index) => (
          <div
            key={item.voucher.id}
            className="print:break-after-page"
            style={index === selectedVoucherDetails.length - 1 ? undefined : { breakAfter: "page" }}
          >
            <VoucherPrintView
              companyName={client.name}
              voucherType={item.voucher.voucher_type}
              voucherDisplayNo={item.voucherDisplayNo}
              voucherDate={item.voucher.voucher_date}
              paymentModeName={item.paymentModeName}
              description={item.voucher.description}
              accountHeadName={item.accountHeadName}
              lines={item.lines}
              totalDebit={item.totalDebit}
              totalCredit={item.totalCredit}
              showDescription={item.voucher.show_description ?? true}
              showSupportingDocuments={item.voucher.show_supporting_documents ?? true}
              attachments={item.attachments}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
