'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { 
  Printer, FileSpreadsheet, Save, Send, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useReactToPrint } from 'react-to-print'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PayrollSalarySheetPrint } from '@/components/payroll/PayrollSalarySheetPrint'
import { savePayrollRunItemsAction } from '@/lib/actions/payroll'
import { postPayrollAccrualAction } from '@/lib/actions/payroll'
import { exportPayroll, type PayrollExportRow } from '@/lib/utils/excel-export'
import { calculatePayrollRowSummary, type PayrollComponentCode } from '@/lib/accounting/payroll'

type PayrollRunItem = {
  id: string
  employee_id: string | null
  employee_code: string | null
  employee_name: string
  designation: string | null
  grade: string | null
  gross_salary: number | null
  total_additions: number | null
  total_deductions: number | null
  net_payable: number | null
  components: {
    id: string
    code: string
    label: string
    kind: string
    amount: number | null
  }[]
}

type PayrollRun = {
  id: string
  period_label: string
  period_start: string
  period_end: string
  status: string
  source: string
  notes: string | null
  accrual_voucher_id: string | null
  payment_voucher_id: string | null
  accrual_voucher_no: number | null
  payment_voucher_no: number | null
  items: PayrollRunItem[]
}

function currency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function numberValue(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function getStatusClass(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
    case 'posted':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-100'
    case 'cancelled':
      return 'bg-slate-100 text-slate-700 hover:bg-slate-100'
    default:
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100'
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function PayrollRunEditor({
  clientId,
  payrollRun,
  fiscalYearLabel,
  companyName,
}: {
  clientId: string
  payrollRun: PayrollRun
  fiscalYearLabel: string
  companyName: string
}) {
  const [isPending, startTransition] = useTransition()
  const printRef = useRef<HTMLDivElement>(null)
  const [localItems, setLocalItems] = useState<PayrollRunItem[]>(payrollRun.items)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const payrollRunLabel = format(new Date(payrollRun.period_start), 'MMMM yyyy')
  const monthLabel = format(new Date(payrollRun.period_start), 'MMM-yy')
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${companyName}-payroll-${monthLabel}`,
  })

  const exportRows = useMemo<PayrollExportRow[]>(() => {
    return localItems.map((item, index) => {
      const componentsForSummary = item.components.map((c) => ({
        code: c.code as PayrollComponentCode,
        amount: numberValue(c.amount),
      }))
      const summary = calculatePayrollRowSummary(componentsForSummary)

      return {
        sl: index + 1,
        employeeCode: item.employee_code,
        staffName: item.employee_name,
        designation: item.designation,
        grade: item.grade,
        basic: summary.basic,
        housing: summary.housing,
        medical: summary.medical,
        conveyance: summary.conveyance,
        subTotal: summary.subTotal,
        pfOrgPart: summary.employerPf,
        bonus: summary.bonus,
        arrear: summary.arrearSalary,
        totalSalary: summary.totalSalary,
        pfTotal: summary.pfTotal,
        loanInstallment: summary.loanInstallment,
        loanInterest: summary.loanInterest,
        tax: summary.tax,
        totalDeduction: summary.totalDeductions,
        netPay: summary.netPayable,
        month: monthLabel,
      }
    })
  }, [localItems, monthLabel])

  const totals = useMemo(() => {
    return exportRows.reduce(
      (acc, row) => {
        acc.basic += row.basic
        acc.housing += row.housing
        acc.medical += row.medical
        acc.conveyance += row.conveyance
        acc.subTotal += row.subTotal
        acc.pfOrgPart += row.pfOrgPart
        acc.bonus += row.bonus
        acc.arrear += row.arrear
        acc.totalSalary += row.totalSalary
        acc.pfTotal += row.pfTotal
        acc.loanInstallment += row.loanInstallment
        acc.loanInterest += row.loanInterest
        acc.tax += row.tax
        acc.totalDeductions += row.totalDeduction
        acc.netPay += row.netPay
        acc.netPayable += row.netPay
        return acc
      },
      {
        basic: 0,
        housing: 0,
        medical: 0,
        conveyance: 0,
        subTotal: 0,
        pfOrgPart: 0,
        bonus: 0,
        arrear: 0,
        totalSalary: 0,
        pfTotal: 0,
        loanInstallment: 0,
        loanInterest: 0,
        tax: 0,
        totalDeductions: 0,
        netPay: 0,
        netPayable: 0,
      }
    )
  }, [exportRows])

  const handleComponentChange = (itemId: string, componentCode: string, newValue: string) => {
    setLocalItems(items => items.map(item => {
      if (item.id !== itemId) return item

      let newComponents = item.components.map(comp => {
        if (comp.code === componentCode) {
          return { ...comp, amount: numberValue(newValue) }
        }
        return comp
      })

      // If component doesn't exist, add it
      if (!newComponents.find(c => c.code === componentCode)) {
        const definitions: Record<string, { label: string; kind: string }> = {
          basic: { label: 'Basic', kind: 'earning' },
          housing: { label: 'Housing', kind: 'earning' },
          medical: { label: 'Medical', kind: 'earning' },
          conveyance: { label: 'Conveyance', kind: 'earning' },
          employer_pf: { label: 'PF (Org Part)', kind: 'earning' },
          bonus: { label: 'Bonus', kind: 'earning' },
          arrear_salary: { label: 'Arrear', kind: 'earning' },
          staff_pf: { label: 'PF (Staff)', kind: 'deduction' },
          loan_installment: { label: 'Loan Installment', kind: 'deduction' },
          loan_interest: { label: 'Loan Interest', kind: 'deduction' },
          tax: { label: 'Tax', kind: 'deduction' },
        }
        const def = definitions[componentCode] || { label: componentCode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), kind: 'earning' }
        newComponents.push({
          id: 'new-' + Date.now(),
          code: componentCode,
          label: def.label,
          kind: def.kind,
          amount: numberValue(newValue)
        })
      }

      // Remove components with 0 amount
      newComponents = newComponents.filter(c => (c.amount ?? 0) > 0)

      // Recalculate summary
      const componentsForSummary = newComponents.map(c => ({ code: c.code as PayrollComponentCode, amount: numberValue(c.amount) }))
      const summary = calculatePayrollRowSummary(componentsForSummary)

      return {
        ...item,
        components: newComponents,
        gross_salary: summary.totalSalary,
        total_additions: summary.totalSalary - summary.subTotal,
        total_deductions: summary.totalDeductions,
        net_payable: summary.netPayable
      }
    }))
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await savePayrollRunItemsAction({
        clientId,
        payrollRunId: payrollRun.id,
        items: localItems.map(item => ({
          id: item.id,
          components: item.components.map(c => ({
            code: c.code as PayrollComponentCode,
            amount: numberValue(c.amount)
          }))
        }))
      })
      if (result.success) {
        toast.success('Draft saved successfully')
      } else {
        toast.error(result.error)
      }
    })
  }

  const handlePostVoucher = () => {
    startTransition(async () => {
      const result = await postPayrollAccrualAction({
        clientId,
        payrollRunId: payrollRun.id,
        voucherDate: format(new Date(), 'yyyy-MM-dd')
      })
      if (result.success) {
        toast.success('Voucher posted successfully')
        // Refresh the page to update status
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleExport = () => {
    exportPayroll(exportRows, companyName, payrollRunLabel, fiscalYearLabel)
  }

  const isEditable = !payrollRun.accrual_voucher_id && !payrollRun.payment_voucher_id

  return (
    <div className="space-y-6">
      <div className="fixed left-[-10000px] top-0">
        <PayrollSalarySheetPrint
          ref={printRef}
          companyName={companyName}
          fiscalYearLabel={fiscalYearLabel}
          payrollRunLabel={payrollRunLabel}
          rows={exportRows}
          totals={totals}
          printedDate={format(new Date(), 'dd MMM yyyy')}
        />
      </div>
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Payroll Run: {payrollRun.period_label}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {format(new Date(payrollRun.period_start), 'MMMM d, yyyy')} - {format(new Date(payrollRun.period_end), 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getStatusClass(payrollRun.status)}>
                {statusLabel(payrollRun.status)}
              </Badge>
              {payrollRun.accrual_voucher_id ? (
                <Link className="text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${payrollRun.accrual_voucher_id}`}>
                  Voucher #{payrollRun.accrual_voucher_no}
                </Link>
              ) : null}
              {payrollRun.payment_voucher_id ? (
                <Link className="text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${payrollRun.payment_voucher_id}`}>
                  Payment #{payrollRun.payment_voucher_no}
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Source</Label>
                <p className="text-sm text-slate-950">{payrollRun.source}</p>
              </div>
              <div>
                <Label>Notes</Label>
                <p className="text-sm text-slate-950">{payrollRun.notes || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Salary Sheet</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Editable salary sheet with expandable rows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handlePrint()} disabled={isPending}>
                <Printer className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button type="button" variant="outline" onClick={handleExport} disabled={isPending}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              {isEditable && (
                <>
                  <Button type="button" variant="outline" onClick={handleSave} disabled={isPending}>
                  <Save className="mr-2 h-4 w-4" />
                    Save Draft
                </Button>
                  <Button type="button" onClick={handlePostVoucher} disabled={isPending}>
                  <Send className="mr-2 h-4 w-4" />
                    Post Voucher
                </Button>
              </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {localItems.map((item, index) => {
                const componentsForSummary = item.components.map(c => ({ code: c.code as PayrollComponentCode, amount: numberValue(c.amount) }))
                const summary = calculatePayrollRowSummary(componentsForSummary)
                const isExpanded = expandedRowId === item.id
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-950">{item.employee_name}</div>
                          <div className="text-sm text-slate-500">
                            {item.designation || "-"} • Grade {item.grade || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-slate-500">Net Pay</div>
                          <div className="font-semibold text-emerald-700">{currency(summary.netPayable)}</div>
                        </div>
                        <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-950 mb-3">Salary Components</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Basic</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.basic}
                                    onChange={(e) => handleComponentChange(item.id, 'basic', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.basic)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Housing</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.housing}
                                    onChange={(e) => handleComponentChange(item.id, 'housing', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.housing)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Medical</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.medical}
                                    onChange={(e) => handleComponentChange(item.id, 'medical', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.medical)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Conveyance</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.conveyance}
                                    onChange={(e) => handleComponentChange(item.id, 'conveyance', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.conveyance)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm font-semibold border-t border-slate-200 pt-2">
                                <span className="text-slate-700">SubTotal</span>
                                <span className="bg-slate-100 px-2 py-1 rounded">{currency(summary.subTotal)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-950 mb-3">Additions</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">PF (Org Part)</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.employerPf}
                                    onChange={(e) => handleComponentChange(item.id, 'employer_pf', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.employerPf)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Bonus</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.bonus}
                                    onChange={(e) => handleComponentChange(item.id, 'bonus', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.bonus)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Arrear</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.arrearSalary}
                                    onChange={(e) => handleComponentChange(item.id, 'arrear_salary', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.arrearSalary)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm font-semibold border-t border-slate-200 pt-2">
                                <span className="text-slate-700">Total Salary</span>
                                <span className="bg-slate-100 px-2 py-1 rounded">{currency(summary.totalSalary)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-950 mb-3">Deductions</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">PF Total</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.pfTotal}
                                    onChange={(e) => {
                                      const newPfTotal = numberValue(e.target.value)
                                      const staffPf = newPfTotal - summary.employerPf
                                      handleComponentChange(item.id, 'staff_pf', String(staffPf))
                                    }}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.pfTotal)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Tax</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.tax}
                                    onChange={(e) => handleComponentChange(item.id, 'tax', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.tax)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Loan Installment</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.loanInstallment}
                                    onChange={(e) => handleComponentChange(item.id, 'loan_installment', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.loanInstallment)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm gap-2">
                                <span className="text-slate-600">Loan Interest</span>
                                {isEditable ? (
                                  <Input
                                    type="number"
                                    value={summary.loanInterest}
                                    onChange={(e) => handleComponentChange(item.id, 'loan_interest', e.target.value)}
                                    className="h-8 w-32 text-right"
                                  />
                                ) : (
                                  <span className="font-medium">{currency(summary.loanInterest)}</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm font-semibold border-t border-slate-200 pt-2">
                                <span className="text-slate-700">Total Deductions</span>
                                <span className="bg-slate-100 px-2 py-1 rounded">{currency(summary.totalDeductions)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm font-semibold border-t border-slate-200 pt-2">
                                <span className="text-emerald-700">Net Pay</span>
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">{currency(summary.netPayable)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Total SubTotal</div>
                    <div className="font-semibold text-slate-950">{currency(totals.subTotal)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Total Salary</div>
                    <div className="font-semibold text-slate-950">{currency(totals.totalSalary)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Total Deductions</div>
                    <div className="font-semibold text-slate-950">{currency(totals.totalDeductions)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Total Net Pay</div>
                    <div className="font-semibold text-emerald-700">{currency(totals.netPayable)}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  )
}
