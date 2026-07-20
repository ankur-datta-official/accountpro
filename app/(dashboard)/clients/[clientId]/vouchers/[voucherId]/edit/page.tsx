import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

import { isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types"

type VoucherRecord = Database["public"]["Tables"]["vouchers"]["Row"]
type VoucherEntryRecord = Database["public"]["Tables"]["voucher_entries"]["Row"]
type FiscalYearRecord = Database["public"]["Tables"]["fiscal_years"]["Row"]
type PaymentModeRecord = Database["public"]["Tables"]["payment_modes"]["Row"]

export default async function EditVoucherPage({
  params,
}: {
  params: Promise<{ clientId: string; voucherId: string }>
}) {
  const resolvedParams = await params
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

  const [{ data: fiscalYear }, { data: paymentModes }, { data: entries }, paymentModeResult] = await Promise.all([
    supabase.from("fiscal_years").select("*").eq("id", voucher.fiscal_year_id ?? "").maybeSingle(),
    supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
    supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id),
    voucher.payment_mode_id ? supabase.from("payment_modes").select("*").eq("id", voucher.payment_mode_id).maybeSingle() : Promise.resolve(null),
  ])
  const voucherRow = voucher as VoucherRecord
  const fiscalYearRow = fiscalYear as FiscalYearRecord | null
  const paymentMode = paymentModeResult?.data ?? null
  const entryRows = (entries ?? []) as VoucherEntryRecord[]
  const paymentModeRows = (paymentModes ?? []) as PaymentModeRecord[]

  if (!fiscalYear) {
    notFound()
  }

  const editableEntries = entryRows.filter((entry: VoucherEntryRecord) => !isAutoBalanceEntry(entry.description))
  const formEntries = (editableEntries.length ? editableEntries : entryRows).map((entry: VoucherEntryRecord) => ({
    accountsGroup: (entry.accounts_group ?? "expense") as "expense" | "income" | "asset" | "liability",
    accountHeadId: entry.account_head_id ?? "",
    debitAmount: Number(entry.debit ?? 0),
    creditAmount: Number(entry.credit ?? 0),
    description: entry.description ?? "",
  }))

  return (
    <div className="space-y-6">
      {fiscalYearRow?.is_closed ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This fiscal year is closed, so this voucher can no longer be edited.
        </div>
      ) : null}

      <VoucherEntryForm
        mode="edit"
        voucherId={voucherRow.id}
        clientId={client.id}
        fiscalYearId={fiscalYearRow!.id}
        fiscalYearStartDate={fiscalYearRow!.start_date}
        fiscalYearEndDate={fiscalYearRow!.end_date}
        defaultVoucherNo={voucherRow.voucher_no}
        paymentModes={paymentModeRows.map((mode: PaymentModeRecord) => ({
          id: mode.id,
          name: mode.name,
          type: mode.type,
        }))}
        initialValues={{
          clientId: client.id,
          fiscalYearId: fiscalYearRow!.id,
          voucherNo: voucherRow.voucher_no,
          voucherDate: voucherRow.voucher_date,
          voucherType: voucherRow.voucher_type,
          paymentModeId: voucherRow.payment_mode_id ?? "",
          paymentModeName: paymentMode?.name ?? "",
          paymentModeType: paymentMode?.type ?? undefined,
          showDescription: voucherRow.show_description ?? true,
          description: voucherRow.description ?? "",
          showSupportingDocuments: voucherRow.show_supporting_documents ?? true,
          lines: formEntries,
        }}
        disabled={Boolean(fiscalYearRow?.is_closed)}
      />
    </div>
  )
}
