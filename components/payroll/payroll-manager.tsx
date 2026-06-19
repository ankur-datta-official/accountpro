"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Calculator, FileSpreadsheet, Loader2, Plus, Save, Send, UploadCloud, WalletCards } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

import {
  createPayrollRunAction,
  deletePayrollRunAction,
  ensurePayrollDefaultsAction,
  postPayrollAccrualAction,
  postPayrollPaymentAction,
  savePayrollEmployeeAction,
} from "@/lib/actions/payroll"
import {
  PAYROLL_COMPONENTS,
  filterSalaryBillRowsForMonth,
  getPayrollRunTotals,
  normalizePayrollRows,
  type ParsedSalaryBillRow,
  type PayrollComponentCode,
  type PayrollDraftRow,
} from "@/lib/accounting/payroll"
import type { PayrollRunStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type PayrollEmployeeRow = {
  id: string
  employee_code: string | null
  name: string
  designation: string | null
  grade: string | null
  phone: string | null
  email: string | null
  tin: string | null
  joining_date: string | null
  leaving_date: string | null
  is_active: boolean | null
  salary?: {
    basic: number | null
    housing: number | null
    medical: number | null
    conveyance: number | null
    employer_pf: number | null
    staff_pf: number | null
    tax: number | null
  } | null
}

type PayrollRunRow = {
  id: string
  period_label: string
  period_start: string
  period_end: string
  status: PayrollRunStatus
  source: "manual" | "import"
  notes: string | null
  accrual_voucher_id: string | null
  payment_voucher_id: string | null
  accrual_voucher_no?: number | null
  payment_voucher_no?: number | null
  totals: {
    grossSalary: number
    totalAdditions: number
    totalDeductions: number
    netPayable: number
  }
}

type PaymentModeOption = {
  id: string
  name: string
  type: string | null
}

type AccountMappingRow = {
  component_code: string
  account_head_id: string
  account_head_name: string
}

type EmployeeFormState = {
  employeeId: string
  employeeCode: string
  name: string
  designation: string
  grade: string
  phone: string
  email: string
  tin: string
  joiningDate: string
  leavingDate: string
  isActive: boolean
  basic: string
  housing: string
  medical: string
  conveyance: string
  employerPf: string
  staffPf: string
  tax: string
}

const emptyEmployeeForm: EmployeeFormState = {
  employeeId: "",
  employeeCode: "",
  name: "",
  designation: "",
  grade: "",
  phone: "",
  email: "",
  tin: "",
  joiningDate: "",
  leavingDate: "",
  isActive: true,
  basic: "0",
  housing: "0",
  medical: "0",
  conveyance: "0",
  employerPf: "0",
  staffPf: "0",
  tax: "0",
}

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: Calculator },
  { id: "employees", label: "Employees", icon: Plus },
  { id: "runs", label: "Payroll Runs", icon: WalletCards },
  { id: "import", label: "Import", icon: UploadCloud },
  { id: "settings", label: "Settings", icon: FileSpreadsheet },
] as const

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function numberValue(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function getStatusClass(status: PayrollRunStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
    case "posted":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100"
    case "cancelled":
      return "bg-slate-100 text-slate-500 hover:bg-slate-100"
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100"
  }
}

function employeeToForm(employee: PayrollEmployeeRow): EmployeeFormState {
  return {
    employeeId: employee.id,
    employeeCode: employee.employee_code ?? "",
    name: employee.name,
    designation: employee.designation ?? "",
    grade: employee.grade ?? "",
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    tin: employee.tin ?? "",
    joiningDate: employee.joining_date ?? "",
    leavingDate: employee.leaving_date ?? "",
    isActive: employee.is_active ?? true,
    basic: String(employee.salary?.basic ?? 0),
    housing: String(employee.salary?.housing ?? 0),
    medical: String(employee.salary?.medical ?? 0),
    conveyance: String(employee.salary?.conveyance ?? 0),
    employerPf: String(employee.salary?.employer_pf ?? 0),
    staffPf: String(employee.salary?.staff_pf ?? 0),
    tax: String(employee.salary?.tax ?? 0),
  }
}

function buildManualRows(employees: PayrollEmployeeRow[]): PayrollDraftRow[] {
  return employees
    .filter((employee) => employee.is_active !== false)
    .map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      designation: employee.designation ?? undefined,
      grade: employee.grade ?? undefined,
      components: [
        { code: "basic" as const, amount: numberValue(employee.salary?.basic) },
        { code: "housing" as const, amount: numberValue(employee.salary?.housing) },
        { code: "medical" as const, amount: numberValue(employee.salary?.medical) },
        { code: "conveyance" as const, amount: numberValue(employee.salary?.conveyance) },
        { code: "employer_pf" as const, amount: numberValue(employee.salary?.employer_pf) },
        { code: "staff_pf" as const, amount: numberValue(employee.salary?.staff_pf) },
        { code: "tax" as const, amount: numberValue(employee.salary?.tax) },
      ],
    }))
}

function cellNumber(row: unknown[], index: number) {
  return numberValue(row[index] as number | string | null | undefined)
}

function parseSalaryWorkbook(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes("salary")) ?? workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: null })
    const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim().toLowerCase() === "staff name"))

    if (headerIndex < 0) {
      throw new Error("No recognizable salary header found in the workbook.")
    }

    const header = rows[headerIndex].map((cell) => String(cell ?? "").trim().toLowerCase())
    const indexOf = (...names: string[]) =>
      header.findIndex((cell) => names.some((name) => cell === name || cell.includes(name)))

    const serialIndex = indexOf("sl.", "sl", "sl no", "serial")
    const nameIndex = indexOf("staff name")
    const designationIndex = indexOf("desig")
    const gradeIndex = indexOf("grade")
    const basicIndex = indexOf("basic")
    const housingIndex = indexOf("housing")
    const medicalIndex = indexOf("medical")
    const conveyanceIndex = indexOf("conveyance")
    const employerPfIndex = indexOf("p.f. (org. part)", "org. part")
    const arrearIndex = indexOf("arear salary", "arrear salary")
    const bonusIndex = indexOf("bonus")
    const pfTotalIndex = indexOf("pf (org.+ staff)", "pf (org")
    const loanInstallmentIndex = indexOf("loan installment")
    const loanInterestIndex = indexOf("loan interest")
    const taxIndex = indexOf("tax")

    const parsedRows = rows
      .slice(headerIndex + 1)
      .map((row) => {
        const employeeName = String(row[nameIndex] ?? "").trim()
        if (!employeeName || employeeName.toLowerCase().includes("total")) return null

        const serialValue = serialIndex >= 0 ? Number(row[serialIndex]) : NaN
        const serial = Number.isFinite(serialValue) && serialValue > 0 ? serialValue : undefined

        return {
          serial,
          employeeName,
          designation: String(row[designationIndex] ?? "").trim() || undefined,
          grade: String(row[gradeIndex] ?? "").trim() || undefined,
          components: [
            { code: "basic" as const, amount: cellNumber(row, basicIndex) },
            { code: "housing" as const, amount: cellNumber(row, housingIndex) },
            { code: "medical" as const, amount: cellNumber(row, medicalIndex) },
            { code: "conveyance" as const, amount: cellNumber(row, conveyanceIndex) },
            { code: "employer_pf" as const, amount: cellNumber(row, employerPfIndex) },
            { code: "arrear_salary" as const, amount: cellNumber(row, arrearIndex) },
            { code: "bonus" as const, amount: cellNumber(row, bonusIndex) },
            { code: "pf_total" as const, amount: cellNumber(row, pfTotalIndex) },
            { code: "loan_installment" as const, amount: cellNumber(row, loanInstallmentIndex) },
            { code: "loan_interest" as const, amount: cellNumber(row, loanInterestIndex) },
            { code: "tax" as const, amount: cellNumber(row, taxIndex) },
          ],
        }
      })
      .filter(Boolean) as ParsedSalaryBillRow[]

    return {
      sheetName,
      rows: parsedRows,
    }
  })
}

export function PayrollManager({
  clientId,
  fiscalYearId,
  fiscalYearLabel,
  fiscalYearStart,
  schemaReady,
  employees,
  payrollRuns,
  paymentModes,
  accountMappings,
}: {
  clientId: string
  fiscalYearId: string
  fiscalYearLabel: string
  fiscalYearStart: string
  schemaReady: boolean
  employees: PayrollEmployeeRow[]
  payrollRuns: PayrollRunRow[]
  paymentModes: PaymentModeOption[]
  accountMappings: AccountMappingRow[]
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("dashboard")
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(emptyEmployeeForm)
  const [runMonth, setRunMonth] = useState(format(new Date(), "yyyy-MM"))
  const [runNotes, setRunNotes] = useState("")
  const [importSourceRows, setImportSourceRows] = useState<ParsedSalaryBillRow[]>([])
  const [importSheetName, setImportSheetName] = useState("")
  const [importMonth, setImportMonth] = useState(format(new Date(), "yyyy-MM"))
  const [importFilterMode, setImportFilterMode] = useState<"single_month" | "yearly_bill" | "out_of_range">("single_month")
  const [importSerial, setImportSerial] = useState<number | null>(null)
  const [paymentModeId, setPaymentModeId] = useState(paymentModes[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()

  const importRows = useMemo(() => {
    if (!importSourceRows.length) return [] as PayrollDraftRow[]

    const filtered = filterSalaryBillRowsForMonth(importSourceRows, fiscalYearStart, importMonth)
    return normalizePayrollRows(filtered.rows)
  }, [importSourceRows, fiscalYearStart, importMonth])

  const manualRows = useMemo(() => normalizePayrollRows(buildManualRows(employees)), [employees])
  const manualTotals = useMemo(() => getPayrollRunTotals(manualRows), [manualRows])
  const importTotals = useMemo(() => getPayrollRunTotals(importRows), [importRows])
  const latestRun = payrollRuns[0]
  const totalPayrollPaid = payrollRuns
    .filter((run) => run.status === "paid")
    .reduce((sum, run) => sum + run.totals.netPayable, 0)

  const updateEmployeeForm = (key: keyof EmployeeFormState, value: string | boolean) => {
    setEmployeeForm((current) => ({ ...current, [key]: value }))
  }

  const saveEmployee = () => {
    startTransition(async () => {
      const result = await savePayrollEmployeeAction({
        clientId,
        employeeId: employeeForm.employeeId || undefined,
        employeeCode: employeeForm.employeeCode || undefined,
        name: employeeForm.name,
        designation: employeeForm.designation || undefined,
        grade: employeeForm.grade || undefined,
        phone: employeeForm.phone || undefined,
        email: employeeForm.email || undefined,
        tin: employeeForm.tin || undefined,
        joiningDate: employeeForm.joiningDate || undefined,
        leavingDate: employeeForm.leavingDate || undefined,
        isActive: employeeForm.isActive,
        salary: {
          basic: numberValue(employeeForm.basic),
          housing: numberValue(employeeForm.housing),
          medical: numberValue(employeeForm.medical),
          conveyance: numberValue(employeeForm.conveyance),
          employerPf: numberValue(employeeForm.employerPf),
          staffPf: numberValue(employeeForm.staffPf),
          tax: numberValue(employeeForm.tax),
        },
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Employee and salary structure saved.")
      setEmployeeForm(emptyEmployeeForm)
    })
  }

  const createManualRun = () => {
    startTransition(async () => {
      const result = await createPayrollRunAction({
        clientId,
        fiscalYearId,
        month: runMonth,
        source: "manual",
        notes: runNotes || undefined,
        rows: manualRows,
        createMissingEmployees: false,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Payroll run created from salary structures.")
      setRunNotes("")
      setActiveTab("runs")
    })
  }

  const saveImportedRun = () => {
    startTransition(async () => {
      const result = await createPayrollRunAction({
        clientId,
        fiscalYearId,
        month: importMonth,
        source: "import",
        notes: "Created from imported salary sheet",
        rows: importRows,
        createMissingEmployees: true,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Imported payroll run saved as draft.")
      setImportSourceRows([])
      setImportSheetName("")
      setActiveTab("runs")
    })
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return

    try {
      const parsed = await parseSalaryWorkbook(file)
      const filtered = filterSalaryBillRowsForMonth(parsed.rows, fiscalYearStart, importMonth)
      setImportSourceRows(parsed.rows)
      setImportSheetName(parsed.sheetName)
      setImportFilterMode(filtered.mode)
      setImportSerial(filtered.serial)

      if (filtered.mode === "out_of_range") {
        toast.error("Selected payroll month is outside the active fiscal year.")
        return
      }

      const readyRows = normalizePayrollRows(filtered.rows)
      if (filtered.mode === "yearly_bill") {
        toast.success(
          `${readyRows.length} employee row(s) loaded for month serial ${filtered.serial} from ${parsed.sheetName}.`
        )
      } else {
        toast.success(`${readyRows.length} payroll rows parsed from ${file.name}.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to parse salary sheet.")
    }
  }

  const postAccrual = (payrollRunId: string) => {
    startTransition(async () => {
      const result = await postPayrollAccrualAction({
        clientId,
        payrollRunId,
        voucherDate: format(new Date(), "yyyy-MM-dd"),
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Payroll accrual posted as voucher #${result.voucherNo}.`)
    })
  }

  const postPayment = (payrollRunId: string) => {
    const mode = paymentModes.find((item) => item.id === paymentModeId)

    startTransition(async () => {
      const result = await postPayrollPaymentAction({
        clientId,
        payrollRunId,
        voucherDate: format(new Date(), "yyyy-MM-dd"),
        paymentModeId: mode?.id,
        paymentModeName: mode?.name,
        paymentModeType: (mode?.type ?? "cash") as "bank" | "cash" | "mobile_banking" | "other",
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Payroll payment posted as voucher #${result.voucherNo}.`)
    })
  }

  const deleteRun = (payrollRunId: string) => {
    startTransition(async () => {
      const result = await deletePayrollRunAction({ clientId, payrollRunId })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Draft payroll run deleted.")
    })
  }

  const ensureDefaults = () => {
    startTransition(async () => {
      const result = await ensurePayrollDefaultsAction({ clientId })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Payroll ledger defaults are ready.")
    })
  }

  const statCards = [
    { label: "Active Employees", value: employees.filter((employee) => employee.is_active !== false).length },
    { label: "Payroll Runs", value: payrollRuns.length },
    { label: "Latest Net Payable", value: currency(latestRun?.totals.netPayable ?? 0) },
    { label: "Paid Payroll", value: currency(totalPayrollPaid) },
  ]

  return (
    <div className="space-y-6">
      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Payroll database setup is required.</p>
          <p className="mt-2">
            Run <code className="rounded bg-amber-100 px-1.5 py-0.5">npm run db:setup</code> after adding{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5">SUPABASE_DB_PASSWORD</code> to{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5">.env.local</code>, or paste{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5">006_add_payroll_module.sql</code> into Supabase SQL Editor.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Payroll</h2>
          <p className="mt-1 text-sm text-slate-500">Fiscal year: {fiscalYearLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <Button
                key={tab.id}
                type="button"
                variant={active ? "default" : "outline"}
                className="h-9 rounded-lg"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            )
          })}
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.label} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-950">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <PayrollRunsTable
            clientId={clientId}
            payrollRuns={payrollRuns.slice(0, 5)}
            paymentModeId={paymentModeId}
            paymentModes={paymentModes}
            setPaymentModeId={setPaymentModeId}
            postAccrual={postAccrual}
            postPayment={postPayment}
            deleteRun={deleteRun}
            isPending={isPending}
          />
        </div>
      ) : null}

      {activeTab === "employees" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>{employeeForm.employeeId ? "Edit Employee" : "Add Employee"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Code" value={employeeForm.employeeCode} onChange={(value) => updateEmployeeForm("employeeCode", value)} />
                <Field label="Name" value={employeeForm.name} onChange={(value) => updateEmployeeForm("name", value)} />
                <Field label="Designation" value={employeeForm.designation} onChange={(value) => updateEmployeeForm("designation", value)} />
                <Field label="Grade" value={employeeForm.grade} onChange={(value) => updateEmployeeForm("grade", value)} />
                <Field label="Phone" value={employeeForm.phone} onChange={(value) => updateEmployeeForm("phone", value)} />
                <Field label="Email" value={employeeForm.email} onChange={(value) => updateEmployeeForm("email", value)} />
                <Field label="TIN" value={employeeForm.tin} onChange={(value) => updateEmployeeForm("tin", value)} />
                <Field label="Joining Date" type="date" value={employeeForm.joiningDate} onChange={(value) => updateEmployeeForm("joiningDate", value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Basic" type="number" value={employeeForm.basic} onChange={(value) => updateEmployeeForm("basic", value)} />
                <Field label="Housing" type="number" value={employeeForm.housing} onChange={(value) => updateEmployeeForm("housing", value)} />
                <Field label="Medical" type="number" value={employeeForm.medical} onChange={(value) => updateEmployeeForm("medical", value)} />
                <Field label="Conveyance" type="number" value={employeeForm.conveyance} onChange={(value) => updateEmployeeForm("conveyance", value)} />
                <Field label="Employer PF" type="number" value={employeeForm.employerPf} onChange={(value) => updateEmployeeForm("employerPf", value)} />
                <Field label="Staff PF" type="number" value={employeeForm.staffPf} onChange={(value) => updateEmployeeForm("staffPf", value)} />
                <Field label="Tax" type="number" value={employeeForm.tax} onChange={(value) => updateEmployeeForm("tax", value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={employeeForm.isActive}
                  onChange={(event) => updateEmployeeForm("isActive", event.target.checked)}
                />
                Active employee
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={saveEmployee} disabled={isPending || !schemaReady}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEmployeeForm(emptyEmployeeForm)}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Employees & Salary Structures</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Net Base</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const gross =
                      numberValue(employee.salary?.basic) +
                      numberValue(employee.salary?.housing) +
                      numberValue(employee.salary?.medical) +
                      numberValue(employee.salary?.conveyance) +
                      numberValue(employee.salary?.employer_pf)
                    const deductions = numberValue(employee.salary?.staff_pf) + numberValue(employee.salary?.tax)
                    return (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium text-slate-950">{employee.name}</TableCell>
                        <TableCell>{employee.designation || "-"}</TableCell>
                        <TableCell>{currency(gross)}</TableCell>
                        <TableCell>{currency(gross - deductions)}</TableCell>
                        <TableCell>{employee.is_active === false ? "Inactive" : "Active"}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEmployeeForm(employeeToForm(employee))}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "runs" ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Create Payroll Run</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
              <Field label="Month" type="month" value={runMonth} onChange={setRunMonth} />
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={runNotes} onChange={(event) => setRunNotes(event.target.value)} rows={1} />
              </div>
              <Button type="button" onClick={createManualRun} disabled={isPending || manualRows.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Create From Structures
              </Button>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 lg:col-span-3">
                Ready rows: {manualRows.length} | Gross {currency(manualTotals.grossSalary)} | Deductions{" "}
                {currency(manualTotals.totalDeductions)} | Net {currency(manualTotals.netPayable)}
              </div>
            </CardContent>
          </Card>
          <PayrollRunsTable
            clientId={clientId}
            payrollRuns={payrollRuns}
            paymentModeId={paymentModeId}
            paymentModes={paymentModes}
            setPaymentModeId={setPaymentModeId}
            postAccrual={postAccrual}
            postPayment={postPayment}
            deleteRun={deleteRun}
            isPending={isPending}
          />
        </div>
      ) : null}

      {activeTab === "import" ? (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Import Salary Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
              <Field
                label="Payroll Month"
                type="month"
                value={importMonth}
                onChange={(value) => {
                  setImportMonth(value)
                  if (importSourceRows.length) {
                    const filtered = filterSalaryBillRowsForMonth(importSourceRows, fiscalYearStart, value)
                    setImportFilterMode(filtered.mode)
                    setImportSerial(filtered.serial)
                  }
                }}
              />
              <label className="flex h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-sm text-slate-600">
                <UploadCloud className="h-4 w-4" />
                Upload Excel salary sheet
                <input
                  type="file"
                  className="sr-only"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    handleImportFile(event.target.files?.[0] ?? null)
                    event.target.value = ""
                  }}
                />
              </label>
              <Button type="button" onClick={saveImportedRun} disabled={isPending || importRows.length === 0 || !schemaReady}>
                Save Draft Run
              </Button>
            </div>
            {importSourceRows.length ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Source sheet: {importSheetName || "Salary"} | Parsed rows: {importSourceRows.length}
                {importFilterMode === "yearly_bill" ? (
                  <>
                    {" "}
                    | Using fiscal month serial {importSerial} for {importMonth}
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryTile label="Rows" value={String(importRows.length)} />
              <SummaryTile label="Gross" value={currency(importTotals.grossSalary)} />
              <SummaryTile label="Deductions" value={currency(importTotals.totalDeductions)} />
              <SummaryTile label="Net Payable" value={currency(importTotals.netPayable)} />
            </div>
            <PayrollRowsPreview rows={importRows} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "settings" ? (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Payroll Account Mappings</CardTitle>
            <Button type="button" variant="outline" onClick={ensureDefaults} disabled={isPending}>
              Prepare Defaults
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Account Head</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountMappings.map((mapping) => (
                  <TableRow key={mapping.component_code}>
                    <TableCell className="font-medium text-slate-950">{mapping.component_code.replace(/_/g, " ")}</TableCell>
                    <TableCell>{mapping.account_head_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function PayrollRowsPreview({ rows }: { rows: PayrollDraftRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead>Components</TableHead>
          <TableHead>Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.slice(0, 20).map((row, index) => {
            const totals = getPayrollRunTotals([row])
            return (
              <TableRow key={`${row.employeeName}-${index}`}>
                <TableCell className="font-medium text-slate-950">{row.employeeName}</TableCell>
                <TableCell>{row.designation || "-"}</TableCell>
                <TableCell>
                  {row.components
                    .map((component) => `${PAYROLL_COMPONENTS[component.code].label}: ${currency(component.amount)}`)
                    .join(", ")}
                </TableCell>
                <TableCell>{currency(totals.netPayable)}</TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="py-10 text-center text-slate-500">
              Upload a salary sheet to preview payroll rows.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function PayrollRunsTable({
  clientId,
  payrollRuns,
  paymentModeId,
  paymentModes,
  setPaymentModeId,
  postAccrual,
  postPayment,
  deleteRun,
  isPending,
}: {
  clientId: string
  payrollRuns: PayrollRunRow[]
  paymentModeId: string
  paymentModes: PaymentModeOption[]
  setPaymentModeId: (value: string) => void
  postAccrual: (payrollRunId: string) => void
  postPayment: (payrollRunId: string) => void
  deleteRun: (payrollRunId: string) => void
  isPending: boolean
}) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Payroll Runs</CardTitle>
        <select
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={paymentModeId}
          onChange={(event) => setPaymentModeId(event.target.value)}
        >
          {paymentModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Payable</TableHead>
              <TableHead>Vouchers</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRuns.length ? (
              payrollRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <p className="font-medium text-slate-950">{run.period_label}</p>
                    <p className="text-xs text-slate-500">{run.source}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusClass(run.status)}>{run.status}</Badge>
                  </TableCell>
                  <TableCell>{currency(run.totals.grossSalary)}</TableCell>
                  <TableCell>{currency(run.totals.totalDeductions)}</TableCell>
                  <TableCell>{currency(run.totals.netPayable)}</TableCell>
                  <TableCell className="space-y-1">
                    {run.accrual_voucher_id ? (
                      <Link className="block text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${run.accrual_voucher_id}`}>
                        Accrual #{run.accrual_voucher_no ?? "-"}
                      </Link>
                    ) : (
                      <span className="block text-sm text-slate-400">No accrual</span>
                    )}
                    {run.payment_voucher_id ? (
                      <Link className="block text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${run.payment_voucher_id}`}>
                        Payment #{run.payment_voucher_no ?? "-"}
                      </Link>
                    ) : (
                      <span className="block text-sm text-slate-400">No payment</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {!run.accrual_voucher_id ? (
                        <Button type="button" size="sm" onClick={() => postAccrual(run.id)} disabled={isPending}>
                          <Send className="mr-2 h-4 w-4" />
                          Post
                        </Button>
                      ) : null}
                      {run.accrual_voucher_id && !run.payment_voucher_id ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => postPayment(run.id)} disabled={isPending || !paymentModeId}>
                          Pay
                        </Button>
                      ) : null}
                      {(run.status === "draft" || run.status === "reviewed") && !run.accrual_voucher_id ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => deleteRun(run.id)} disabled={isPending}>
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  No payroll runs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
