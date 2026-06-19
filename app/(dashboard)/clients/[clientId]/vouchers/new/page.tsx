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

  return (
    <div className="space-y-6">
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
