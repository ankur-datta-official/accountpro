"use client"

import { useMemo, useState } from "react"
import { Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { parseExcelFile, type ParsedVoucher, importVouchers } from "@/lib/utils/excel-import"

export function ExcelImportManager({
  clientId,
  fiscalYears,
}: {
  clientId: string
  fiscalYears: Array<{ id: string; label: string }>
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState<ParsedVoucher[]>([])
  const [progress, setProgress] = useState(0)
  const [uploadName, setUploadName] = useState("")
  const [fiscalYearId, setFiscalYearId] = useState(fiscalYears[0]?.id ?? "")
  const [importing, setImporting] = useState(false)
  const [resultText, setResultText] = useState("")

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.valid).length
    const errors = rows.length - valid
    return { total: rows.length, valid, errors }
  }, [rows])

  const onFile = async (file: File) => {
    try {
      const parsed = await parseExcelFile(file)
      setRows(parsed)
      setUploadName(file.name)
      setStep(2)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse file.")
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setProgress(10)
    try {
      setProgress(35)
      const result = await importVouchers(clientId, fiscalYearId, rows)
      setProgress(100)
      setResultText(`${result.imported} imported successfully, ${result.skipped} skipped`)
      toast.success("Import completed.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Excel Import</h2>
        <p className="mt-1 text-sm text-slate-500">Import vouchers from Excel Home sheet format.</p>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-700">Step 1 — Upload</p>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Upload className="h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm text-slate-700">Drag and drop .xlsx / .xlsm or click to choose</p>
          <Input
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onFile(file)
            }}
          />
        </label>
        {uploadName ? <p className="mt-3 text-sm text-slate-500">Uploaded: {uploadName}</p> : null}
      </Card>

      {step >= 2 ? (
        <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">Step 2 — Map Columns</p>
          <p className="text-sm text-slate-500">Columns auto-detected from Home sheet. Review and continue.</p>
          <Button className="mt-4" onClick={() => setStep(3)}>
            Confirm Mapping
          </Button>
        </Card>
      ) : null}

      {step >= 3 ? (
        <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">Step 3 — Preview</p>
          <p className="mb-4 text-sm text-slate-600">
            {summary.total} vouchers found, {summary.valid} valid, {summary.errors} errors
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Voucher #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Account Head</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Receipts</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((row) => (
                <TableRow key={`${row.rowNumber}-${row.voucherNo}`} className={row.valid ? "" : "bg-red-50"}>
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell>{row.voucherNo}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.accountHead}</TableCell>
                  <TableCell>{row.voucherTypeRaw}</TableCell>
                  <TableCell>{row.receipts}</TableCell>
                  <TableCell>{row.payments}</TableCell>
                  <TableCell>{row.valid ? "Valid" : row.errors.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button className="mt-4" onClick={() => setStep(4)}>
            Continue to Import
          </Button>
        </Card>
      ) : null}

      {step >= 4 ? (
        <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">Step 4 — Import</p>
          <div className="max-w-xs space-y-2">
            <Label>Fiscal Year</Label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 px-3"
              value={fiscalYearId}
              onChange={(event) => setFiscalYearId(event.target.value)}
            >
              {fiscalYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
          <Button className="mt-4" disabled={importing || !summary.valid} onClick={() => void handleImport()}>
            Import {summary.valid} Vouchers
          </Button>
          {importing || progress > 0 ? (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {resultText ? <p className="mt-4 text-sm text-emerald-700">{resultText}</p> : null}
        </Card>
      ) : null}
    </div>
  )
}
