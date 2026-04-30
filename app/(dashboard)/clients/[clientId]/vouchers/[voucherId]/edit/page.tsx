import { format } from "date-fns"
import { notFound } from "next/navigation"

import { isAutoBalanceEntry } from "@/lib/accounting/vouchers"
import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

export default async function EditVoucherPage({
  params,
}: {
  params: { clientId: string; voucherId: string }
}) {
  const supabase = createClient()
  const { membership } = await getCurrentOrganizationContext()

  const { data: client } = membership?.org_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", params.clientId)
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null }

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

  const [{ data: fiscalYear }, { data: paymentModes }, { data: entries }] = await Promise.all([
    supabase.from("fiscal_years").select("*").eq("id", voucher.fiscal_year_id ?? "").maybeSingle(),
    supabase.from("payment_modes").select("*").eq("client_id", client.id).order("name"),
    supabase.from("voucher_entries").select("*").eq("voucher_id", voucher.id),
  ])

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
          description: voucher.description ?? "",
          lines: formEntries,
        }}
        disabled={Boolean(fiscalYear.is_closed)}
        lastUpdated={voucher.updated_at ? format(new Date(voucher.updated_at), "dd MMM yyyy, h:mm a") : null}
      />
    </div>
  )
}
