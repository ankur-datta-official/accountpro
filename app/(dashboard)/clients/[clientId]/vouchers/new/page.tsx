import Link from "next/link"
import { notFound } from "next/navigation"

import { VoucherEntryForm } from "@/components/voucher/voucher-entry-form"
import { getClientRouteContext } from "@/lib/accounting/client-route-context"
import { createClient } from "@/lib/supabase/server"

export default async function NewVoucherPage({
  params,
  searchParams,
}: {
  params: { clientId: string }
  searchParams: { fiscalYear?: string }
}) {
  const supabase = createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
    fiscalYearId: searchParams.fiscalYear,
  })

  if (!client) {
    notFound()
  }

  if (!selectedFiscalYear) {
    notFound()
  }

  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("voucher_no")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .order("voucher_no", { ascending: false })
    .limit(1)

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .eq("is_active", true)
    .order("name")

  const { data: openingBalanceVoucher } = await supabase
    .from("vouchers")
    .select("id")
    .eq("client_id", client.id)
    .eq("fiscal_year_id", selectedFiscalYear.id)
    .eq("voucher_type", "bf")
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6">
      {!openingBalanceVoucher ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Opening balances are missing for {selectedFiscalYear.label}. Enter them first to keep the
          ledger and reports accurate.
          <Link
            href={`/clients/${client.id}/vouchers/opening-balance?fiscalYear=${selectedFiscalYear.id}`}
            className="ml-2 font-semibold underline underline-offset-4"
          >
            Go to Opening Balance Entry
          </Link>
        </div>
      ) : null}

      <VoucherEntryForm
        clientId={client.id}
        clientName={client.name}
        fiscalYearId={selectedFiscalYear.id}
        fiscalYearLabel={selectedFiscalYear.label}
        defaultVoucherNo={Number(vouchers?.[0]?.voucher_no ?? 0) + 1}
        paymentModes={(paymentModes ?? []).map((mode) => ({
          id: mode.id,
          name: mode.name,
          type: mode.type,
        }))}
      />
    </div>
  )
}
