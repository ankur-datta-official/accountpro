import { format } from "date-fns"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

import { isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"

export default async function EditVoucherPage({
  params,
}: {
  params: { clientId: string; voucherId: string }
}) {
  const supabase = createClient()
  const { client } = await getClientRouteContext({ clientId: params.clientId })

  if (!client) {
    notFound()
  }

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("*")
    .eq("id", params.voucherId)
    .eq("client_id", client.id)
    .maybeSingle()

  if (!voucher) {
    notFound()
  }

  const [
    { data: fiscalYear }, 
    { data: paymentModes }, 
    { data: entries }, 
    paymentModeResult
  ] = await Promise.all([
    supabase.from("fiscal_years").select("*").eq("id", voucher.fiscal_year_id ?? "").maybeSingle(),
    supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
    supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id),
    voucher.payment_mode_id ? supabase.from("payment_modes").select("*").eq("id", voucher.payment_mode_id).maybeSingle() : Promise.resolve(null),
  ])
  const paymentMode = paymentModeResult?.data ?? null

  if (!fiscalYear) {
    notFound()
  }

  const editableEntries = (entries ?? []).filter((entry) => !isAutoBalanceEntry(entry.description))
  const formEntries = (editableEntries.length ? editableEntries : entries ?? []).map((entry) => ({
    accountsGroup: (entry.accounts_group ?? "expense") as "expense" | "income" | "asset" | "liability",
    accountHeadId: entry.account_head_id ?? "",
    debitAmount: Number(entry.debit ?? 0),
    creditAmount: Number(entry.credit ?? 0),
    description: entry.description ?? "",
  }))

  return (
    <div className="space-y-6">
      {fiscalYear.is_closed ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This fiscal year is closed, so this voucher can no longer be edited.
        </div>
      ) : null}

      <VoucherEntryForm
        mode="edit"
        voucherId={voucher.id}
        clientId={client.id}
        clientName={client.name}
        fiscalYearId={fiscalYear.id}
        fiscalYearLabel={fiscalYear.label}
        defaultVoucherNo={voucher.voucher_no}
        paymentModes={(paymentModes ?? []).map((mode) => ({
          id: mode.id,
          name: mode.name,
          type: mode.type,
        }))}
        initialValues={{
          clientId: client.id,
          fiscalYearId: fiscalYear.id,
          voucherNo: voucher.voucher_no,
          voucherDate: voucher.voucher_date,
          voucherType: voucher.voucher_type,
          paymentModeId: voucher.payment_mode_id ?? "",
          paymentModeName: paymentMode?.name ?? "",
          paymentModeType: paymentMode?.type ?? undefined,
          showDescription: voucher.show_description ?? true,
          description: voucher.description ?? "",
          showSupportingDocuments: voucher.show_supporting_documents ?? true,
          lines: formEntries,
        }}
        disabled={Boolean(fiscalYear.is_closed)}
        lastUpdated={voucher.updated_at ? format(new Date(voucher.updated_at), "dd MMM yyyy, h:mm a") : null}
      />
    </div>
  )
}
