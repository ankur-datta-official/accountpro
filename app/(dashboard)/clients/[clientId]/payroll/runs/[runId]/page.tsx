import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getClientRouteContext } from '@/lib/accounting/client-route-context'
import { PayrollRunEditor } from './payroll-run-editor'
import type { Database } from '@/lib/types'

type PayrollRunItemRow = Database['public']['Tables']['payroll_run_items']['Row']
type PayrollRunComponentRow = Database['public']['Tables']['payroll_run_components']['Row']
type VoucherRow = Pick<Database['public']['Tables']['vouchers']['Row'], 'id' | 'voucher_no'>
type PayrollEmployeeCodeRow = Pick<Database['public']['Tables']['payroll_employees']['Row'], 'id' | 'employee_code'>

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; runId: string }>
}) {
  const resolvedParams = await params
  const supabase = await createClient()
  const { client, selectedFiscalYear } = await getClientRouteContext({
    clientId: resolvedParams.clientId,
  })

  if (!client) {
    notFound()
  }

  // Fetch payroll run
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', resolvedParams.runId)
    .eq('client_id', client.id)
    .single()

  if (runError || !run) {
    notFound()
  }

  // Fetch payroll run items
  const { data: itemsResult } = await supabase
    .from('payroll_run_items')
    .select('*')
    .eq('payroll_run_id', run.id)
    .order('employee_name')
  const items = (itemsResult ?? []) as PayrollRunItemRow[]

  const employeeIds = Array.from(new Set((items || []).map((item) => item.employee_id).filter((id): id is string => Boolean(id))))
  const { data: payrollEmployeesResult } = employeeIds.length
    ? await supabase
        .from('payroll_employees')
        .select('id, employee_code')
        .in('id', employeeIds)
    : { data: [] }
  const payrollEmployees = (payrollEmployeesResult ?? []) as PayrollEmployeeCodeRow[]

  // Fetch components for each item
  const itemIds = (items || []).map(item => item.id)
  const { data: componentsResult } = itemIds.length
    ? await supabase.from('payroll_run_components').select('*').in('run_item_id', itemIds)
    : { data: [] }
  const components = (componentsResult ?? []) as PayrollRunComponentRow[]

  // Fetch vouchers if needed
  const voucherIds = [run.accrual_voucher_id, run.payment_voucher_id].filter((id): id is string => id != null)
  const { data: vouchersResult } = voucherIds.length
    ? await supabase.from('vouchers').select('id, voucher_no').in('id', voucherIds)
    : { data: [] }
  const vouchers = (vouchersResult ?? []) as VoucherRow[]

  // Fetch payment modes
  const voucherNoById = new Map((vouchers || []).map(v => [v.id, v.voucher_no]))
  const employeeCodeById = new Map((payrollEmployees || []).map((employee) => [employee.id, employee.employee_code]))

  // Build the run object with items and components
  const payrollRun = {
    ...run,
    accrual_voucher_no: run.accrual_voucher_id ? voucherNoById.get(run.accrual_voucher_id) ?? null : null,
    payment_voucher_no: run.payment_voucher_id ? voucherNoById.get(run.payment_voucher_id) ?? null : null,
    items: (items || []).map(item => ({
      ...item,
      employee_code: item.employee_id ? employeeCodeById.get(item.employee_id) ?? null : null,
      components: (components || []).filter(c => c.run_item_id === item.id),
    })),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/clients/${resolvedParams.clientId}/payroll`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Payroll
        </Link>
      </div>
      <PayrollRunEditor
        clientId={resolvedParams.clientId}
        payrollRun={payrollRun}
        fiscalYearLabel={selectedFiscalYear?.label || ''}
        companyName={client.trade_name || client.name}
      />
    </div>
  )
}
