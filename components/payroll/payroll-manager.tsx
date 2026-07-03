"use client"

import Link from "next/link"
import { memo, useCallback, useMemo, useState, useTransition, useEffect } from "react"
import { format } from "date-fns"
import { X, Calculator, BookOpen, Wallet, Banknote, CheckCircle2, ChevronDown, HelpCircle, Loader2, PlayCircle, Save, Send, Settings, Trash2, UserPlus, Users, WalletCards, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import {
  createPayrollRunAction,
  deletePayrollRunAction,
  ensurePayrollDefaultsAction,
  postPayrollAccrualAction,
  postPayrollPaymentAction,
  rerunPayrollRunAction,
  savePayrollEmployeeAction,
  savePayrollPolicyAction,
  savePayrollAccountMappingsAction,
} from "@/lib/actions/payroll"
import { exportPayroll } from "@/lib/utils"
import {
  PAYROLL_COMPONENTS,
  calculatePayrollRowSummary,
  getPayrollRunTotals,
  normalizePayrollRows,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  { id: "employees", label: "Employees", icon: Users },
  { id: "run", label: "Run Payroll", icon: PlayCircle },
  { id: "settings", label: "Settings", icon: Settings },
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

function statusLabel(status: PayrollRunStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
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



type PayrollPolicy = {
  housingPercent: number | null
  medicalPercent: number | null
  conveyancePercent: number | null
  employerPfPercent: number | null
  staffPfPercent: number | null
  taxPercent: number | null
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
  payrollPolicy,
  accountHeads,
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
  payrollPolicy: PayrollPolicy | null
  accountHeads: { id: string; name: string }[]
}) {
  // First declare ALL state variables
  const [showGuide, setShowGuide] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)
  const [policyForm, setPolicyForm] = useState({
    housingPercent: String(payrollPolicy?.housingPercent ?? 0),
    medicalPercent: String(payrollPolicy?.medicalPercent ?? 0),
    conveyancePercent: String(payrollPolicy?.conveyancePercent ?? 0),
    employerPfPercent: String(payrollPolicy?.employerPfPercent ?? 0),
    staffPfPercent: String(payrollPolicy?.staffPfPercent ?? 0),
    taxPercent: String(payrollPolicy?.taxPercent ?? 0),
  })

  const [mappingForm, setMappingForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const mapping of accountMappings) {
      initial[mapping.component_code] = mapping.account_head_id
    }
    return initial
  })

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("dashboard")
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(emptyEmployeeForm)
  const [isAddEmployeeFormOpen, setIsAddEmployeeFormOpen] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [localEmployees, setLocalEmployees] = useState<PayrollEmployeeRow[]>(employees)
  const [runMonth, setRunMonth] = useState(format(new Date(), "yyyy-MM"))
  const [runNotes, setRunNotes] = useState("")
  const [paymentModeId, setPaymentModeId] = useState(paymentModes[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()

  // Hydration: sync with localStorage after component mounts
  useEffect(() => {
    setIsHydrated(true)
    const workflowClosed = localStorage.getItem(`payroll-workflow-closed-${clientId}`)
    setShowGuide(workflowClosed !== 'true')
  }, [clientId])

  // Sync localEmployees with employees prop
  useEffect(() => {
    setLocalEmployees(employees)
  }, [employees])

  const handleDismissGuide = useCallback(() => {
    setShowGuide(false)
    localStorage.setItem(`payroll-workflow-closed-${clientId}`, 'true')
  }, [clientId])

  const handleShowGuide = useCallback(() => {
    setShowGuide(true)
    localStorage.setItem(`payroll-workflow-closed-${clientId}`, 'false')
  }, [clientId])

  const savePayrollPolicy = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await savePayrollPolicyAction({
          clientId,
          housingPercent: Number(policyForm.housingPercent),
          medicalPercent: Number(policyForm.medicalPercent),
          conveyancePercent: Number(policyForm.conveyancePercent),
          employerPfPercent: Number(policyForm.employerPfPercent),
          staffPfPercent: Number(policyForm.staffPfPercent),
          taxPercent: Number(policyForm.taxPercent),
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to save payroll policy")
          return
        }

        toast.success("Payroll policy saved!")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save payroll policy")
      }
    })
  }, [clientId, policyForm])

  const saveAccountMappings = useCallback(() => {
    startTransition(async () => {
      try {
        const mappings = Object.entries(mappingForm).map(([componentCode, accountHeadId]) => ({
          componentCode,
          accountHeadId,
        }))

        const result = await savePayrollAccountMappingsAction({
          clientId,
          mappings,
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to save account mappings")
          return
        }

        toast.success("Account mappings saved!")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save account mappings")
      }
    })
  }, [clientId, mappingForm])

  const autoCalculateFromBasic = useCallback((basic: number) => {
    const policy = payrollPolicy
    if (!policy) return {}

    return {
      housing: String((basic * (policy.housingPercent ?? 0)) / 100),
      medical: String((basic * (policy.medicalPercent ?? 0)) / 100),
      conveyance: String((basic * (policy.conveyancePercent ?? 0)) / 100),
      employerPf: String((basic * (policy.employerPfPercent ?? 0)) / 100),
      staffPf: String((basic * (policy.staffPfPercent ?? 0)) / 100),
      tax: String((basic * (policy.taxPercent ?? 0)) / 100),
    }
  }, [payrollPolicy])

  // Handle employee salary component changes with auto-calc when basic changes
  const handleEmployeeSalaryChange = useCallback((employeeId: string, component: keyof PayrollEmployeeRow['salary'], newValue: string) => {
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== employeeId) return emp
      
      let newSalary = { ...emp.salary, [component]: numberValue(newValue) }
      
      // If basic changed, auto-calculate other components
      if (component === 'basic') {
        const calculated = autoCalculateFromBasic(numberValue(newValue))
        newSalary = {
          ...newSalary,
          housing: numberValue(calculated.housing),
          medical: numberValue(calculated.medical),
          conveyance: numberValue(calculated.conveyance),
          employer_pf: numberValue(calculated.employerPf),
          staff_pf: numberValue(calculated.staffPf),
          tax: numberValue(calculated.tax)
        }
      }
      
      return { ...emp, salary: newSalary }
    }))
  }, [autoCalculateFromBasic])

  const handleInlineEditChange = useCallback((employeeId: string, field: keyof EmployeeFormState, value: string | boolean) => {
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== employeeId) return emp
      
      // Handle salary fields specially
      if (['basic', 'housing', 'medical', 'conveyance', 'employerPf', 'staffPf', 'tax'].includes(field)) {
        const salaryField = field === 'employerPf' ? 'employer_pf' : 
                           field === 'staffPf' ? 'staff_pf' : 
                           field as keyof PayrollEmployeeRow['salary']
        
        let newSalary = { ...emp.salary, [salaryField]: numberValue(value as string) }
        
        // If basic changed, auto-calculate other components
        if (field === 'basic') {
          const calculated = autoCalculateFromBasic(numberValue(value as string))
          newSalary = {
            ...newSalary,
            housing: numberValue(calculated.housing),
            medical: numberValue(calculated.medical),
            conveyance: numberValue(calculated.conveyance),
            employer_pf: numberValue(calculated.employerPf),
            staff_pf: numberValue(calculated.staffPf),
            tax: numberValue(calculated.tax)
          }
        }
        return { ...emp, salary: newSalary }
      }

      // Handle other fields
      const mapField = field === 'employeeCode' ? 'employee_code' :
                     field === 'joiningDate' ? 'joining_date' :
                     field === 'leavingDate' ? 'leaving_date' :
                     field === 'isActive' ? 'is_active' : field
      
      return { ...emp, [mapField]: value }
    }))
  }, [autoCalculateFromBasic])

  const manualRows = useMemo(() => normalizePayrollRows(buildManualRows(employees)), [employees])
  const manualTotals = useMemo(() => getPayrollRunTotals(manualRows), [manualRows])
  const latestRun = payrollRuns[0]
  const activeEmployeeCount = useMemo(
    () => employees.filter((employee) => employee.is_active !== false).length,
    [employees]
  )
  const totalPayrollPaid = useMemo(
    () =>
      payrollRuns
        .filter((run) => run.status === "paid")
        .reduce((sum, run) => sum + run.totals.netPayable, 0),
    [payrollRuns]
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  const dashboardStats = useMemo(() => {
    const totalRuns = payrollRuns.length
    const totalGross = payrollRuns.reduce((sum, run) => sum + run.totals.grossSalary, 0)
    const totalDeductions = payrollRuns.reduce((sum, run) => sum + run.totals.totalDeductions, 0)
    const totalNet = payrollRuns.reduce((sum, run) => sum + run.totals.netPayable, 0)
    return { totalRuns, totalGross, totalDeductions, totalNet }
  }, [payrollRuns])

  const filteredPayrollRuns = useMemo(() => {
    return payrollRuns.filter((run) => {
      const matchesSearch = run.period_label.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || run.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [payrollRuns, searchQuery, statusFilter])

  const updateEmployeeForm = useCallback((key: keyof EmployeeFormState, value: string | boolean) => {
    if (key === "isActive") {
      // Only isActive is boolean, others are string
      setEmployeeForm((current) => ({ ...current, [key]: value as boolean }))
    } else {
      // All other keys are string
      const stringValue = value as string
      if (key === "basic") {
        const calculatedFields = autoCalculateFromBasic(Number(stringValue))
        setEmployeeForm((current) => ({
          ...current,
          [key]: stringValue,
          ...calculatedFields,
        }))
      } else {
        setEmployeeForm((current) => ({ ...current, [key]: stringValue }))
      }
    }
  }, [autoCalculateFromBasic])

  const saveEmployee = useCallback(() => {
    startTransition(async () => {
      try {
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

        if (!result?.success) {
          toast.error(result?.error || "Failed to save employee")
          return
        }

        toast.success("Employee and salary structure saved.")
        setEmployeeForm(emptyEmployeeForm)
        setIsAddEmployeeFormOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save employee")
      }
    })
  }, [clientId, employeeForm])

  const createManualRun = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await createPayrollRunAction({
          clientId,
          fiscalYearId,
          month: runMonth,
          source: "manual",
          notes: runNotes || undefined,
          rows: manualRows,
          createMissingEmployees: false,
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to create payroll run")
          return
        }

        toast.success("Payroll run created from salary structures.")
        setRunNotes("")
        setActiveTab("dashboard")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create payroll run")
      }
    })
  }, [clientId, fiscalYearId, manualRows, runMonth, runNotes])



  const postAccrual = useCallback((payrollRunId: string) => {
    startTransition(async () => {
      try {
        const result = await postPayrollAccrualAction({
          clientId,
          payrollRunId,
          voucherDate: format(new Date(), "yyyy-MM-dd"),
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to post payroll accrual")
          return
        }

        toast.success(`Payroll accrual posted as voucher #${result.voucherNo}.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to post payroll accrual")
      }
    })
  }, [clientId])

  const postPayment = useCallback((payrollRunId: string) => {
    const mode = paymentModes.find((item) => item.id === paymentModeId)

    startTransition(async () => {
      try {
        const result = await postPayrollPaymentAction({
          clientId,
          payrollRunId,
          voucherDate: format(new Date(), "yyyy-MM-dd"),
          paymentModeId: mode?.id,
          paymentModeName: mode?.name,
          paymentModeType: (mode?.type ?? "cash") as "bank" | "cash" | "mobile_banking" | "other",
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to post payroll payment")
          return
        }

        toast.success(`Payroll payment posted as voucher #${result.voucherNo}.`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to post payroll payment")
      }
    })
  }, [clientId, paymentModeId, paymentModes])

  const deleteRun = useCallback((payrollRunId: string) => {
    startTransition(async () => {
      try {
        const result = await deletePayrollRunAction({ clientId, payrollRunId })

        if (!result?.success) {
          toast.error(result?.error || "Failed to delete payroll run")
          return
        }

        toast.success("Draft payroll run deleted.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete payroll run")
      }
    })
  }, [clientId])

  const rerunPayroll = useCallback((payrollRunId: string) => {
    startTransition(async () => {
      try {
        const result = await rerunPayrollRunAction({
          clientId,
          payrollRunId,
          reason: "Re-run after employee salary edits.",
        })

        if (!result?.success) {
          toast.error(result?.error || "Failed to re-run payroll")
          return
        }

        toast.success("Payroll re-run with the latest salary setup.")
        setActiveTab("dashboard")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to re-run payroll")
      }
    })
  }, [clientId])

  const ensureDefaults = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await ensurePayrollDefaultsAction({ clientId })

        if (!result?.success) {
          toast.error(result?.error || "Failed to set up payroll defaults")
          return
        }

        toast.success("Payroll ledger defaults are ready.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to set up payroll defaults")
      }
    })
  }, [clientId])

  const saveInlineEmployee = useCallback((employeeId: string) => {
    startTransition(async () => {
      const emp = localEmployees.find(e => e.id === employeeId);
      if (!emp) {
        toast.error("Employee not found.");
        return;
      }
      
      try {
        const result = await savePayrollEmployeeAction({
          clientId,
          employeeId: emp.id,
          employeeCode: emp.employee_code || "",
          name: emp.name,
          designation: emp.designation || "",
          grade: emp.grade || "",
          phone: emp.phone || "",
          email: emp.email || "",
          tin: emp.tin || "",
          joiningDate: emp.joining_date || "",
          leavingDate: emp.leaving_date || "",
          isActive: emp.is_active !== false,
          salary: emp.salary ? {
            basic: numberValue(emp.salary.basic),
            housing: numberValue(emp.salary.housing),
            medical: numberValue(emp.salary.medical),
            conveyance: numberValue(emp.salary.conveyance),
            employerPf: numberValue(emp.salary.employer_pf),
            staffPf: numberValue(emp.salary.staff_pf),
            tax: numberValue(emp.salary.tax),
          } : undefined,
        });

        if (result.success) {
          toast.success("Employee saved successfully!");
          setEditingEmployeeId(null);
        } else {
          toast.error(result.error || "Failed to save employee.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save employee.");
      }
    });
  }, [clientId, localEmployees, startTransition]);

  const handleExportEmployees = useCallback(() => {
    const exportData = employees.map((employee, index) => {
      const summary = calculatePayrollRowSummary([
        { code: "basic", amount: numberValue(employee.salary?.basic) },
        { code: "housing", amount: numberValue(employee.salary?.housing) },
        { code: "medical", amount: numberValue(employee.salary?.medical) },
        { code: "conveyance", amount: numberValue(employee.salary?.conveyance) },
        { code: "employer_pf", amount: numberValue(employee.salary?.employer_pf) },
        { code: "staff_pf", amount: numberValue(employee.salary?.staff_pf) },
        { code: "tax", amount: numberValue(employee.salary?.tax) },
        { code: "loan_installment", amount: 0 },
        { code: "loan_interest", amount: 0 },
        { code: "bonus", amount: 0 },
        { code: "arrear_salary", amount: 0 },
      ])
      return {
        sl: index + 1,
        employeeCode: employee.employee_code,
        staffName: employee.name,
        designation: employee.designation,
        grade: employee.grade,
        basic: numberValue(employee.salary?.basic),
        housing: numberValue(employee.salary?.housing),
        medical: numberValue(employee.salary?.medical),
        conveyance: numberValue(employee.salary?.conveyance),
        subTotal: summary.subTotal,
        pfOrgPart: numberValue(employee.salary?.employer_pf),
        bonus: 0,
        arrear: 0,
        totalSalary: summary.totalSalary,
        pfTotal: summary.pfTotal,
        loanInstallment: 0,
        loanInterest: 0,
        tax: numberValue(employee.salary?.tax),
        totalDeduction: summary.totalDeductions,
        netPay: summary.netPayable,
        month: format(new Date(), "MMMM yyyy"),
      }
    })
    exportPayroll(exportData, "Employee Salary Sheet", format(new Date(), "MMMM yyyy"))
  }, [employees])

  const statCards = useMemo(() => [
    { label: "Total Payroll Runs", value: dashboardStats.totalRuns },
    { label: "Total Gross Salary", value: currency(dashboardStats.totalGross) },
    { label: "Total Deductions", value: currency(dashboardStats.totalDeductions) },
    { label: "Total Net Pay", value: currency(dashboardStats.totalNet) },
  ], [dashboardStats])

  return (
    <TooltipProvider delayDuration={150}>
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
          <p className="mt-1 text-sm text-slate-500">Fiscal year: {fiscalYearLabel}. Create payroll, review it, post it, then pay employees.</p>
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
          {showGuide && <WorkflowGuide onDismiss={handleDismissGuide} payrollRuns={payrollRuns} />}
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
            payrollRuns={filteredPayrollRuns}
            paymentModeId={paymentModeId}
            paymentModes={paymentModes}
            setPaymentModeId={setPaymentModeId}
            postAccrual={postAccrual}
            postPayment={postPayment}
            rerunPayroll={rerunPayroll}
            deleteRun={deleteRun}
            isPending={isPending}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </div>
      ) : null}

      {activeTab === "employees" ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Employee Salary Sheet</CardTitle>
                <p className="text-sm text-slate-500">Responsive salary sheet with expandable details for each employee.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setEmployeeForm(emptyEmployeeForm);
                  setIsAddEmployeeFormOpen(true);
                }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
                <Button type="button" variant="outline" onClick={() => handleExportEmployees()}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {localEmployees.map((employee, index) => {
                  const summary = calculatePayrollRowSummary([
                    { code: "basic", amount: numberValue(employee.salary?.basic) },
                    { code: "housing", amount: numberValue(employee.salary?.housing) },
                    { code: "medical", amount: numberValue(employee.salary?.medical) },
                    { code: "conveyance", amount: numberValue(employee.salary?.conveyance) },
                    { code: "employer_pf", amount: numberValue(employee.salary?.employer_pf) },
                    { code: "staff_pf", amount: numberValue(employee.salary?.staff_pf) },
                    { code: "tax", amount: numberValue(employee.salary?.tax) },
                    { code: "loan_installment", amount: 0 },
                    { code: "loan_interest", amount: 0 },
                    { code: "bonus", amount: 0 },
                    { code: "arrear_salary", amount: 0 },
                  ])
                  const isExpanded = expandedRowId === employee.id
                  const isEditing = editingEmployeeId === employee.id
                  return (
                    <div
                      key={employee.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedRowId(isExpanded ? null : employee.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">{employee.name}</div>
                            <div className="text-sm text-slate-500">
                              {employee.designation || "-"} • Grade {employee.grade || "-"} • {employee.employee_code || "No code"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-slate-500">Net Pay</div>
                            <div className="font-semibold text-emerald-700">{currency(summary.netPayable)}</div>
                          </div>
                          <Badge className={employee.is_active === false ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}>
                            {employee.is_active === false ? "Inactive" : "Active"}
                          </Badge>
                          <Button type="button" variant={isEditing ? "default" : "outline"} size="sm" onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) {
                              setEditingEmployeeId(null);
                            } else {
                              setEditingEmployeeId(employee.id);
                              setExpandedRowId(employee.id);
                            }
                          }}>
                            {isEditing ? "Cancel" : "Edit"}
                          </Button>
                          <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-slate-200 p-4 bg-slate-50">
                          {isEditing ? (
                            <div className="space-y-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Employee Code" help="Optional staff ID used in salary sheets and reports." value={employee.employee_code ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'employeeCode', value)} />
                                <Field label="Employee Name" help="Full name shown on payroll reports." value={employee.name} onChange={(value) => handleInlineEditChange(employee.id, 'name', value)} />
                                <Field label="Job Title" help="The employee's role or designation." value={employee.designation ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'designation', value)} />
                                <Field label="Grade" help="Optional salary grade or level." value={employee.grade ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'grade', value)} />
                                <Field label="Phone" help="Optional contact number." value={employee.phone ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'phone', value)} />
                                <Field label="Email" help="Optional work or personal email." value={employee.email ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'email', value)} />
                                <Field label="TIN" help="Tax identification number, if applicable." value={employee.tin ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'tin', value)} />
                                <Field label="Joining Date" help="Start date for employee records." type="date" value={employee.joining_date ?? ""} onChange={(value) => handleInlineEditChange(employee.id, 'joiningDate', value)} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Basic Salary" help="Main fixed salary amount. Enter this to auto-calculate other components based on payroll policy." type="number" value={String(employee.salary?.basic ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'basic', value)} />
                                <Field label="House Rent" help={`Monthly housing allowance${payrollPolicy?.housingPercent ? ` (${payrollPolicy.housingPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.housing ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'housing', value)} />
                                <Field label="Medical Allowance" help={`Monthly medical allowance${payrollPolicy?.medicalPercent ? ` (${payrollPolicy.medicalPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.medical ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'medical', value)} />
                                <Field label="Travel Allowance" help={`Monthly conveyance or travel allowance${payrollPolicy?.conveyancePercent ? ` (${payrollPolicy.conveyancePercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.conveyance ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'conveyance', value)} />
                                <Field label="Employer PF" help={`Company provident fund contribution${payrollPolicy?.employerPfPercent ? ` (${payrollPolicy.employerPfPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.employer_pf ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'employerPf', value)} />
                                <Field label="Employee PF" help={`Provident fund deducted from employee salary${payrollPolicy?.staffPfPercent ? ` (${payrollPolicy.staffPfPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.staff_pf ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'staffPf', value)} />
                                <Field label="Tax Deduction" help={`Monthly tax deducted from salary${payrollPolicy?.taxPercent ? ` (${payrollPolicy.taxPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={String(employee.salary?.tax ?? 0)} onChange={(value) => handleInlineEditChange(employee.id, 'tax', value)} />
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={employee.is_active !== false}
                                  onChange={(event) => handleInlineEditChange(employee.id, 'isActive', event.target.checked)}
                                />
                                Active employee
                              </div>
                              <div className="flex gap-2">
                                <Button type="button" onClick={(e) => {
                                  e.stopPropagation();
                                  saveInlineEmployee(employee.id);
                                }} disabled={isPending || !schemaReady}>
                                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                  Save Employee
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setEditingEmployeeId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-950 mb-3">Salary Components</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-sm gap-2">
                                    <span className="text-slate-600">Basic</span>
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.basic))}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm gap-2">
                                    <span className="text-slate-600">Housing</span>
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.housing))}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm gap-2">
                                    <span className="text-slate-600">Medical</span>
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.medical))}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm gap-2">
                                    <span className="text-slate-600">Conveyance</span>
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.conveyance))}</span>
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
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.employer_pf))}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Bonus</span>
                                    <span className="font-medium">-</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Arrear</span>
                                    <span className="font-medium">-</span>
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
                                    <span className="font-medium text-slate-900">{currency(summary.pfTotal)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm gap-2">
                                    <span className="text-slate-600">Tax</span>
                                    <span className="font-medium text-slate-900">{currency(numberValue(employee.salary?.tax))}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Loan Installment</span>
                                    <span className="font-medium">-</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Loan Interest</span>
                                    <span className="font-medium">-</span>
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
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Add New Employee Form */}
          {isAddEmployeeFormOpen ? (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Add Employee</CardTitle>
                <p className="text-sm text-slate-500">Keep employee details and regular salary amounts in one simple form.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Employee Code" help="Optional staff ID used in salary sheets and reports." value={employeeForm.employeeCode} onChange={(value) => updateEmployeeForm("employeeCode", value)} />
                  <Field label="Employee Name" help="Full name shown on payroll reports." value={employeeForm.name} onChange={(value) => updateEmployeeForm("name", value)} />
                  <Field label="Job Title" help="The employee's role or designation." value={employeeForm.designation} onChange={(value) => updateEmployeeForm("designation", value)} />
                  <Field label="Grade" help="Optional salary grade or level." value={employeeForm.grade} onChange={(value) => updateEmployeeForm("grade", value)} />
                  <Field label="Phone" help="Optional contact number." value={employeeForm.phone} onChange={(value) => updateEmployeeForm("phone", value)} />
                  <Field label="Email" help="Optional work or personal email." value={employeeForm.email} onChange={(value) => updateEmployeeForm("email", value)} />
                  <Field label="TIN" help="Tax identification number, if applicable." value={employeeForm.tin} onChange={(value) => updateEmployeeForm("tin", value)} />
                  <Field label="Joining Date" help="Start date for employee records." type="date" value={employeeForm.joiningDate} onChange={(value) => updateEmployeeForm("joiningDate", value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Basic Salary" help="Main fixed salary amount. Enter this to auto-calculate other components based on payroll policy." type="number" value={employeeForm.basic} onChange={(value) => updateEmployeeForm("basic", value)} />
                  <Field label="House Rent" help={`Monthly housing allowance${payrollPolicy?.housingPercent ? ` (${payrollPolicy.housingPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.housing} onChange={(value) => updateEmployeeForm("housing", value)} />
                  <Field label="Medical Allowance" help={`Monthly medical allowance${payrollPolicy?.medicalPercent ? ` (${payrollPolicy.medicalPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.medical} onChange={(value) => updateEmployeeForm("medical", value)} />
                  <Field label="Travel Allowance" help={`Monthly conveyance or travel allowance${payrollPolicy?.conveyancePercent ? ` (${payrollPolicy.conveyancePercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.conveyance} onChange={(value) => updateEmployeeForm("conveyance", value)} />
                  <Field label="Employer PF" help={`Company provident fund contribution${payrollPolicy?.employerPfPercent ? ` (${payrollPolicy.employerPfPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.employerPf} onChange={(value) => updateEmployeeForm("employerPf", value)} />
                  <Field label="Employee PF" help={`Provident fund deducted from employee salary${payrollPolicy?.staffPfPercent ? ` (${payrollPolicy.staffPfPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.staffPf} onChange={(value) => updateEmployeeForm("staffPf", value)} />
                  <Field label="Tax Deduction" help={`Monthly tax deducted from salary${payrollPolicy?.taxPercent ? ` (${payrollPolicy.taxPercent}% of Basic)` : ''}. Auto-calculated but editable.`} type="number" value={employeeForm.tax} onChange={(value) => updateEmployeeForm("tax", value)} />
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
                    Save Employee
                  </Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setEmployeeForm(emptyEmployeeForm);
                    setIsAddEmployeeFormOpen(false);
                  }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === "run" ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Run Payroll</CardTitle>
              <p className="text-sm text-slate-500">Step 1: create a draft from saved salaries or an Excel salary sheet.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-end">
                <Field label="Payroll Month" help="Choose the month you want to pay." type="month" value={runMonth} onChange={setRunMonth} />
                <div className="space-y-2">
                  <LabelWithHelp label="Notes" help="Optional note saved with this payroll run." />
                  <Textarea value={runNotes} onChange={(event) => setRunNotes(event.target.value)} rows={1} />
                </div>
                <Button type="button" onClick={createManualRun} disabled={isPending || manualRows.length === 0}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run Payroll
                </Button>
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 lg:col-span-3">
                  {manualRows.length} employee(s) ready from saved salaries. Gross Salary {currency(manualTotals.grossSalary)} | Deductions{" "}
                  {currency(manualTotals.totalDeductions)} | Net Pay {currency(manualTotals.netPayable)}
                </div>
              </div>


            </CardContent>
          </Card>
          {showGuide && <WorkflowGuide payrollRuns={payrollRuns} />}
        </div>
      ) : null}



      {activeTab === "settings" ? (
        <div className="space-y-6">
          {!showGuide && (
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardContent className="pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Payroll Workflow Guide</p>
                    <p className="text-sm text-slate-500 mt-1">View the interactive workflow guide to understand payroll operations.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={handleShowGuide}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Show Workflow Guide
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Payroll Policy</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Set percentage allocations from Basic Salary to auto-calculate other components.</p>
              </div>
              <Button type="button" onClick={savePayrollPolicy} disabled={isPending || !schemaReady}>
                <Save className="mr-2 h-4 w-4" />
                Save Policy
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <Field label="House Rent (%)" help="Percentage of Basic Salary for housing allowance." type="number" value={policyForm.housingPercent} onChange={(value) => setPolicyForm(p => ({ ...p, housingPercent: value }))} />
                <Field label="Medical (%)" help="Percentage of Basic Salary for medical allowance." type="number" value={policyForm.medicalPercent} onChange={(value) => setPolicyForm(p => ({ ...p, medicalPercent: value }))} />
                <Field label="Travel (%)" help="Percentage of Basic Salary for conveyance allowance." type="number" value={policyForm.conveyancePercent} onChange={(value) => setPolicyForm(p => ({ ...p, conveyancePercent: value }))} />
                <Field label="Employer PF (%)" help="Percentage of Basic Salary for employer's PF contribution." type="number" value={policyForm.employerPfPercent} onChange={(value) => setPolicyForm(p => ({ ...p, employerPfPercent: value }))} />
                <Field label="Employee PF (%)" help="Percentage of Basic Salary for employee's PF deduction." type="number" value={policyForm.staffPfPercent} onChange={(value) => setPolicyForm(p => ({ ...p, staffPfPercent: value }))} />
                <Field label="Tax (%)" help="Percentage of Basic Salary for tax deduction." type="number" value={policyForm.taxPercent} onChange={(value) => setPolicyForm(p => ({ ...p, taxPercent: value }))} />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Account Mappings</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Ledger accounts used when payroll is posted. These determine where payroll transactions are recorded.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={ensureDefaults} disabled={isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Prepare Defaults
                </Button>
                <Button type="button" onClick={saveAccountMappings} disabled={isPending || !schemaReady}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Mappings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Component</TableHead>
                    <TableHead className="min-w-[300px]">Account Head</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { code: "salary_expense", label: "Salary Expense", help: "Debit account for employee salaries (Basic, Housing, Medical, Conveyance)" },
                    { code: "employer_pf_expense", label: "Employer PF Expense", help: "Debit account for employer's provident fund contribution" },
                    { code: "gratuity_expense", label: "Gratuity Expense", help: "Debit account for gratuity/gf contributions" },
                    { code: "bonus_expense", label: "Bonus Expense", help: "Debit account for bonus/allowance payments" },
                    { code: "salary_payable", label: "Salary Payable", help: "Credit account for net salary payable to employees" },
                    { code: "pf_payable", label: "PF Payable", help: "Credit account for provident fund deductions (employee and employer portions)" },
                    { code: "tax_payable", label: "Tax Payable", help: "Credit account for tax deductions from salaries" },
                    { code: "staff_loan_advance", label: "Staff Loan/Advance", help: "Debit account for staff loan/advance deductions" },
                    { code: "loan_interest_income", label: "Loan Interest Income", help: "Credit account for interest income from staff loans" },
                  ].map(({ code, label, help }) => (
                    <TableRow key={code}>
                      <TableCell className="font-medium text-slate-950">
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          <HelpTooltip text={help} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                          value={mappingForm[code] || ""}
                          onChange={(e) => setMappingForm((prev) => ({ ...prev, [code]: e.target.value }))}
                        >
                          <option value="">Select Account Head</option>
                          {accountHeads.map((head) => (
                            <option key={head.id} value={head.id}>
                              {head.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
    </TooltipProvider>
  )
}

function Field({
  label,
  help,
  value,
  onChange,
  type = "text",
}: {
  label: string
  help?: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <LabelWithHelp label={label} help={help} />
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function LabelWithHelp({ label, help }: { label: string; help?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      {help ? <HelpTooltip text={help} /> : null}
    </div>
  )
}

function HelpTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-slate-400 transition hover:text-slate-600" aria-label={text}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

function WorkflowGuide({ 
  onDismiss, 
  payrollRuns 
}: { 
  onDismiss?: () => void, 
  payrollRuns?: PayrollRunRow[] 
}) {
  const latestRun = payrollRuns?.[0]
  const currentStep = latestRun ? (
    latestRun.status === "paid" ? 3 :
    latestRun.status === "posted" ? 2 : 1
  ) : 1

  const steps = [
    { 
      label: "Run Payroll", 
      description: "Generate monthly salary sheet",
      tooltip: "Run Payroll = Generate monthly salary sheet",
      icon: Calculator,
      completed: !!latestRun,
      current: currentStep === 1 && (!latestRun || latestRun.status === "draft" || latestRun.status === "reviewed")
    },
    { 
      label: "Post to Accounts", 
      description: "Create the payroll accounting voucher",
      tooltip: "Post to Accounts = Create vouchers",
      icon: BookOpen,
      completed: !!latestRun?.accrual_voucher_id,
      current: currentStep === 2 && !!latestRun && !latestRun.payment_voucher_id
    },
    { 
      label: "Make Payment", 
      description: "Record salary payment from cash or bank",
      tooltip: "Make Payment = Record salary disbursement",
      icon: Wallet,
      completed: !!latestRun?.payment_voucher_id,
      current: currentStep === 3 && !!latestRun && latestRun.status !== "paid"
    },
  ]

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm p-5 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2">
      {onDismiss && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 p-2 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Hide Workflow Guide"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Hide Workflow Guide</TooltipContent>
        </Tooltip>
      )}
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-950">Payroll Workflow</h3>
        <p className="text-sm text-slate-500 mt-1">Follow these steps to complete payroll processing</p>
      </div>

      {/* Horizontal Stepper - Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isLast = index === steps.length - 1
          
          return (
            <div key={step.label} className="flex-1 flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center cursor-pointer group">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition-all duration-200 ${
                      step.completed 
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' 
                        : step.current 
                          ? 'bg-blue-500 text-white ring-4 ring-blue-100 scale-105' 
                          : 'bg-white text-slate-400 border-2 border-slate-300 group-hover:border-slate-400'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="h-7 w-7" />
                      ) : (
                        <Icon className="h-7 w-7" />
                      )}
                    </div>
                    
                    <div className="mt-3 text-center">
                      <p className={`text-sm font-semibold ${
                        step.completed ? 'text-emerald-700' : step.current ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                        {step.label}
                      </p>
                      {step.current && (
                        <Badge className="mt-1 bg-blue-100 text-blue-700 text-xs">Current</Badge>
                      )}
                      {step.completed && (
                        <Badge className="mt-1 bg-emerald-100 text-emerald-700 text-xs">Done</Badge>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">
                  <p className="font-semibold">{step.label}</p>
                  <p className="mt-1">{step.tooltip}</p>
                </TooltipContent>
              </Tooltip>
              
              {!isLast && (
                <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-300 ${
                  step.completed ? 'bg-emerald-500' : 'bg-slate-200'
                }`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    step.completed ? 'bg-emerald-500' : ''
                  }`}></div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Stacked Stepper - Mobile */}
      <div className="md:hidden space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          
          return (
            <Tooltip key={step.label}>
              <TooltipTrigger asChild>
                <div 
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    step.completed 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : step.current 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm z-10 transition-all ${
                    step.completed 
                      ? 'bg-emerald-500 text-white' 
                      : step.current 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-slate-400 border-2 border-slate-300'
                  }`}>
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${
                        step.completed ? 'text-emerald-900' : step.current ? 'text-blue-900' : 'text-slate-700'
                      }`}>
                        {step.label}
                      </p>
                      {step.current && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>
                      )}
                      {step.completed && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Done</Badge>
                      )}
                    </div>
                    
                    <div className={`mt-1 text-sm ${
                      step.completed ? 'text-emerald-600' : step.current ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {step.description}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-xs">
                {step.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}



const PayrollRunsTable = memo(function PayrollRunsTable({
  clientId,
  payrollRuns,
  paymentModeId,
  paymentModes,
  setPaymentModeId,
  postAccrual,
  postPayment,
  rerunPayroll,
  deleteRun,
  isPending,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: {
  clientId: string
  payrollRuns: PayrollRunRow[]
  paymentModeId: string
  paymentModes: PaymentModeOption[]
  setPaymentModeId: (value: string) => void
  postAccrual: (payrollRunId: string) => void
  postPayment: (payrollRunId: string) => void
  rerunPayroll: (payrollRunId: string) => void
  deleteRun: (payrollRunId: string) => void
  isPending: boolean
  searchQuery: string
  setSearchQuery: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
}) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Payroll Runs</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Review totals, re-run drafts after edits, then post to accounts and make payment.</p>
          </div>
          <div className="space-y-1.5">
            <LabelWithHelp label="Pay From" help="Choose the cash or bank account used when you click Pay Now." />
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
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <LabelWithHelp label="Search" help="Search by payroll period" />
            <Input
              type="text"
              placeholder="Search payroll periods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <LabelWithHelp label="Status" help="Filter by payroll status" />
            <select
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="reviewed">Reviewed</option>
              <option value="posted">Posted</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gross Salary</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Pay</TableHead>
              <TableHead>Vouchers</TableHead>
              <TableHead className="text-right">Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRuns.length ? (
              payrollRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link href={`/clients/${clientId}/payroll/runs/${run.id}`} className="block">
                      <p className="font-medium text-slate-950 hover:text-blue-700">{run.period_label}</p>
                      <p className="text-xs text-slate-500">{run.source}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusClass(run.status)}>{statusLabel(run.status)}</Badge>
                  </TableCell>
                  <TableCell>{currency(run.totals.grossSalary)}</TableCell>
                  <TableCell>{currency(run.totals.totalDeductions)}</TableCell>
                  <TableCell>{currency(run.totals.netPayable)}</TableCell>
                  <TableCell className="space-y-1">
                    {run.accrual_voucher_id ? (
                      <Link className="block text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${run.accrual_voucher_id}`}>
                        Posted voucher #{run.accrual_voucher_no ?? "-"}
                      </Link>
                    ) : (
                      <span className="block text-sm text-slate-400">Not posted</span>
                    )}
                    {run.payment_voucher_id ? (
                      <Link className="block text-sm text-blue-700 hover:underline" href={`/clients/${clientId}/vouchers/${run.payment_voucher_id}`}>
                        Payment #{run.payment_voucher_no ?? "-"}
                      </Link>
                    ) : (
                      <span className="block text-sm text-slate-400">Not paid</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/clients/${clientId}/payroll/runs/${run.id}`}>
                        <Button type="button" size="sm" variant="outline" disabled={isPending}>
                          View / Edit
                        </Button>
                      </Link>
                      {!run.accrual_voucher_id ? (
                        <Button type="button" size="sm" onClick={() => postAccrual(run.id)} disabled={isPending}>
                          <Send className="mr-2 h-4 w-4" />
                          Post to Accounts
                        </Button>
                      ) : null}
                      {run.accrual_voucher_id && !run.payment_voucher_id ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => postPayment(run.id)} disabled={isPending || !paymentModeId}>
                          <Banknote className="mr-2 h-4 w-4" />
                          Make Payment
                        </Button>
                      ) : null}
                      {(run.status === "draft" || run.status === "reviewed") && !run.accrual_voucher_id ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => rerunPayroll(run.id)} disabled={isPending}>
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Re-run
                        </Button>
                      ) : null}
                      {(run.status === "draft" || run.status === "reviewed") && !run.accrual_voucher_id ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => deleteRun(run.id)} disabled={isPending}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      ) : null}
                      {run.payment_voucher_id ? <span className="text-sm font-medium text-emerald-700">Paid</span> : null}
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
})
