"use client"

import { useMemo, useState, useTransition } from "react"
import { FileBadge2, FileDown, History, Lock, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

import type { SalaryCertificateSnapshot } from "@/lib/accounting/salary-certificates"
import type { SalaryCertificateListItem } from "@/lib/salary-certificates/service"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/EmptyState"
import { PageHeader } from "@/components/ui/page-shell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  clientId: string
  clientName: string
  schemaReady: boolean
  selectedFiscalYearId: string
  fiscalYears: Array<{ id: string; label: string }>
  employees: Array<{
    id: string
    name: string
    employeeCode: string | null
    designation: string | null
  }>
  initialHistory: SalaryCertificateListItem[]
}

type PreviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: SalaryCertificateSnapshot }

function currency(value: number) {
  return value.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusTone(status: SalaryCertificateListItem["status"]) {
  if (status === "issued") return "bg-emerald-100 text-emerald-700"
  if (status === "cancelled") return "bg-red-100 text-red-700"
  return "bg-amber-100 text-amber-700"
}

export function SalaryCertificateManager({
  clientId,
  clientName,
  schemaReady,
  selectedFiscalYearId,
  fiscalYears,
  employees,
  initialHistory,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "")
  const [fiscalYearId, setFiscalYearId] = useState(selectedFiscalYearId)
  const [history, setHistory] = useState(initialHistory)
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" })

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employeeId, employees]
  )

  async function refreshHistory(nextEmployeeId = employeeId, nextFiscalYearId = fiscalYearId) {
    const query = new URLSearchParams({ fiscalYearId: nextFiscalYearId })
    if (nextEmployeeId) {
      query.set("employeeId", nextEmployeeId)
    }

    const response = await fetch(`/api/clients/${clientId}/salary-certificates?${query.toString()}`)
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh salary certificate history.")
    }
    setHistory(payload.history ?? [])
  }

  function handlePreview() {
    if (!employeeId || !fiscalYearId) return
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          preview: "true",
          employeeId,
          fiscalYearId,
        })
        const response = await fetch(`/api/clients/${clientId}/salary-certificates?${params.toString()}`)
        const payload = await response.json()
        if (!response.ok) {
          setPreview({ status: "error", message: payload.error ?? "Unable to build preview." })
          return
        }

        setPreview({ status: "ready", snapshot: payload.snapshot })
      } catch (error) {
        setPreview({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to build preview.",
        })
      }
    })
  }

  function handleGenerate() {
    if (!employeeId || !fiscalYearId) return
    startTransition(async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/salary-certificates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, fiscalYearId }),
        })
        const payload = await response.json()
        if (!response.ok) {
          setPreview({ status: "error", message: payload.error ?? "Unable to generate draft." })
          return
        }

        setPreview({ status: "ready", snapshot: payload.snapshot })
        await refreshHistory()
        router.refresh()
      } catch (error) {
        setPreview({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to generate draft.",
        })
      }
    })
  }

  function handleIssue(certificateId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/clients/${clientId}/salary-certificates/${certificateId}/issue`, {
        method: "POST",
      })
      const payload = await response.json()
      if (!response.ok) {
        setPreview({ status: "error", message: payload.error ?? "Unable to issue certificate." })
        return
      }

      await refreshHistory()
      router.refresh()
    })
  }

  function handleDownload(certificateId: string) {
    window.location.assign(`/api/clients/${clientId}/salary-certificates/${certificateId}/download`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Certificates"
        description="Generate annual employee salary certificates directly from payroll runs, keep a historical snapshot, and download a PDF copy."
        eyebrow="Financial Statements"
        icon={FileBadge2}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Certificate Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Employee</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">Fiscal year</span>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={fiscalYearId}
                  onChange={(event) => setFiscalYearId(event.target.value)}
                >
                  {fiscalYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={handlePreview} disabled={isPending || !employeeId || !schemaReady}>
                Preview
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={isPending || !employeeId || !schemaReady}>
                {isPending ? "Working..." : "Generate"}
              </Button>
            </div>

            {!schemaReady ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Salary certificate database setup is incomplete. Apply the latest migration, then reload this page.
              </div>
            ) : null}

            {preview.status === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {preview.message}
              </div>
            ) : null}

            {preview.status === "ready" ? (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{preview.snapshot.employee.name}</p>
                    <p className="text-sm text-slate-500">
                      {preview.snapshot.employee.designation ?? selectedEmployee?.designation ?? "Employee"} at {clientName}
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full bg-slate-200 text-slate-700">
                    {preview.snapshot.certificateNo}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Gross Salary</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">BDT {currency(preview.snapshot.salary.gross)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Net Salary</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">BDT {currency(preview.snapshot.salary.netSalary)}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 text-sm text-slate-600">
                  Coverage: {preview.snapshot.payrollCoverage.coveredMonths.length} of{" "}
                  {preview.snapshot.payrollCoverage.expectedMonths.length} payroll months validated.
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.certificateNo}</div>
                        <div className="text-xs text-slate-500">{row.fiscalYearLabel}</div>
                      </TableCell>
                      <TableCell>{row.employeeName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleDownload(row.id)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                          {row.status === "draft" ? (
                            <Button type="button" size="sm" onClick={() => handleIssue(row.id)} disabled={isPending}>
                              <Lock className="mr-2 h-4 w-4" />
                              Issue
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No certificates yet"
                description="Preview and generate a salary certificate for the selected employee to start the history."
                icon={History}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">Snapshot Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {preview.status === "ready" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SnapshotMetric label="Basic" value={preview.snapshot.salary.basic} />
              <SnapshotMetric label="House Rent" value={preview.snapshot.salary.houseRent} />
              <SnapshotMetric label="Medical" value={preview.snapshot.salary.medical} />
              <SnapshotMetric label="Conveyance" value={preview.snapshot.salary.conveyance} />
              <SnapshotMetric label="Other Allowance" value={preview.snapshot.salary.otherAllowance} />
              <SnapshotMetric label="Tax Deduction" value={preview.snapshot.salary.taxDeduction} />
              <SnapshotMetric label="Other Deduction" value={preview.snapshot.salary.otherDeduction} />
              <SnapshotMetric label="Employee TDS" value={preview.snapshot.tax.employeeTds} />
            </div>
          ) : (
            <EmptyState
              title="Preview required"
              description="Run a preview to inspect the annual aggregation before generating the certificate."
              icon={RefreshCw}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SnapshotMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">BDT {currency(value)}</p>
    </div>
  )
}
