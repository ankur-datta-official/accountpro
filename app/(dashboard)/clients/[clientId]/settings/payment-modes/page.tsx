import { notFound } from "next/navigation"
import { Landmark } from "lucide-react"

import { PaymentModeForm } from "@/components/clients/PaymentModeForm"
import { TogglePaymentModeButton } from "@/components/clients/toggle-payment-mode-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient, getCurrentOrganizationContext } from "@/lib/supabase/server"

function formatType(value: string | null) {
  return (value ?? "other").replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export default async function PaymentModesPage({
  params,
}: {
  params: { clientId: string }
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

  const { data: paymentModes } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("client_id", client.id)
    .order("name")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Payment Modes</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Manage client-specific bank accounts, cash books, and collection modes.
          </p>
        </div>
        <PaymentModeForm clientId={client.id} />
      </div>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Client payment modes</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentModes?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentModes.map((mode) => (
                  <TableRow key={mode.id}>
                    <TableCell className="font-medium text-slate-900">{mode.name}</TableCell>
                    <TableCell>{formatType(mode.type)}</TableCell>
                    <TableCell>{mode.account_no || "—"}</TableCell>
                    <TableCell>
                      {mode.is_active ? (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-500">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <PaymentModeForm
                          clientId={client.id}
                          mode={{
                            id: mode.id,
                            name: mode.name,
                            type: mode.type ?? "other",
                            account_no: mode.account_no,
                            is_active: mode.is_active,
                          }}
                        />
                        <TogglePaymentModeButton
                          clientId={client.id}
                          paymentModeId={mode.id}
                          isActive={Boolean(mode.is_active)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Landmark className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">No payment modes yet</h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                Add the bank accounts, mobile wallets, or cash books this client uses for bookkeeping.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
