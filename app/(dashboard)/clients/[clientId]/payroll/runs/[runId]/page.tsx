import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

import { createClient } from '@/lib/supabase/server'
import { getClientRouteContext } from '@/lib/accounting/client-route-context'
import { PayrollRunEditor } from './payroll-run-editor'

export default async function PayrollRunDetailPage({
  params,
}: {
  params: { clientId: string; runId: string }
}) {
  const supabase = createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: params.clientId,
  })

  if (!client) {
    notFound()
  }

  // Fetch payroll run
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', params.runId)
    .eq('client_id', client.id)
    .single()

  if (runError || !run) {
    notFound()
  }

  // Fetch payroll run items
  const { data: items } = await supabase
    .from('payroll_run_items')
    .select('*')
    .eq('payroll_run_id', run.id)
    .order('employee_name')

  // Fetch components for each item
  const itemIds = (items || []).map(item => item.id)
  const { data: components } = itemIds.length
    ? await supabase.from('payroll_run_components').select('*').in('run_item_id', itemIds)
    : { data: [] }

  // Fetch vouchers if needed
  const voucherIds = [run.accrual_voucher_id, run.payment_voucher_id].filter(Boolean)
  const { data: vouchers } = voucherIds.length
    ? await supabase.from('vouchers').select('id, voucher_no').in('id', voucherIds)
    : { data: [] }

  // Fetch payment modes
  const { data: paymentModes } = await supabase
    .from('payment_modes')
    .select('*')
    .eq('client_id', client.id)
    .eq('is_active', true)
    .order('name')

  const voucherNoById = new Map((vouchers || []).map(v => [v.id, v.voucher_no]))

  // Build the run object with items and components
  const payrollRun = {
    ...run,
    accrual_voucher_no: run.accrual_voucher_id ? voucherNoById.get(run.accrual_voucher_id) ?? null : null,
    payment_voucher_no: run.payment_voucher_id ? voucherNoById.get(run.payment_voucher_id) ?? null : null,
    items: (items || []).map(item => ({
      ...item,
      components: (components || []).filter(c => c.run_item_id === item.id),
    })),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/clients/${params.clientId}/payroll`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Payroll
        </Link>
      </div>
      <PayrollRunEditor
        clientId={params.clientId}
        payrollRun={payrollRun}
        fiscalYearId={selectedFiscalYear?.id || ''}
        paymentModes={(paymentModes || []).map(mode => ({
          id: mode.id,
          name: mode.name,
          type: mode.type
        }))}
      />
    </div>
  )
}
