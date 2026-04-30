"use client"

import * as XLSX from "xlsx"

import { createClient } from "@/lib/supabase/client"
import type { VoucherType } from "@/lib/types"

export type ParsedVoucher = {
  rowNumber: number
  voucherNo: number
  date: string
  accountsGroup: string
  accountHead: string
  voucherTypeRaw: string
  voucherType: VoucherType | null
  paymentMode: string
  receipts: number
  payments: number
  description: string
  month: string
  valid: boolean
  errors: string[]
}

export type ImportResult = {
  imported: number
  skipped: number
  errors: Array<{ rowNumber: number; reason: string }>
}

const REQUIRED_HEADERS = [
  "Voucher #",
  "Date",
  "Accounts Group",
  "Accounts Head",
  "Voucher Type",
  "Payment Mode",
  "Receipts",
  "Payments",
  "Description",
]

export function mapVoucherType(excelValue: string): VoucherType | null {
  const normalized = excelValue.trim().toLowerCase()
  if (normalized === "payment") return "payment"
  if (normalized === "received" || normalized === "receipt") return "received"
  if (normalized === "journal") return "journal"
  if (normalized === "contra") return "contra"
  if (normalized === "b/f") return "bf"
  if (normalized === "b/p") return "bp"
  if (normalized === "b/r") return "br"
  return null
}

export function validateVoucher(row: ParsedVoucher): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!row.voucherNo || Number.isNaN(row.voucherNo)) errors.push("Invalid voucher number")
  if (!row.date) errors.push("Date is required")
  if (!row.accountHead) errors.push("Account Head is required")
  if (!row.voucherType) errors.push("Unknown voucher type")
  if (row.receipts === 0 && row.payments === 0) errors.push("Either receipts or payments must be non-zero")
  return { valid: errors.length === 0, errors }
}

export async function parseExcelFile(file: File): Promise<ParsedVoucher[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const homeSheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "home") ?? workbook.SheetNames[0]
  if (!homeSheetName) {
    throw new Error("No sheet found in uploaded file.")
  }

  const ws = workbook.Sheets[homeSheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    raw: false,
    blankrows: false,
  })

  const headerIndex = matrix.findIndex((row) => {
    const values = row.map((value) => String(value ?? "").trim().toLowerCase())
    return values.includes("voucher #") && values.includes("accounts head")
  })

  if (headerIndex === -1) {
    throw new Error("Could not detect required headers in Home sheet.")
  }

  const headers = matrix[headerIndex].map((value) => String(value ?? "").trim())
  for (const required of REQUIRED_HEADERS) {
    if (!headers.some((header) => header.toLowerCase() === required.toLowerCase())) {
      throw new Error(`Required column missing: ${required}`)
    }
  }

  const getIndex = (label: string) => headers.findIndex((header) => header.toLowerCase() === label.toLowerCase())

  const rows = matrix.slice(headerIndex + 1)
  const parsed: ParsedVoucher[] = rows.map((row, idx) => {
    const voucherTypeRaw = String(row[getIndex("Voucher Type")] ?? "").trim()
    const item: ParsedVoucher = {
      rowNumber: headerIndex + idx + 2,
      voucherNo: Number(row[getIndex("Voucher #")] ?? 0),
      date: String(row[getIndex("Date")] ?? "").trim(),
      accountsGroup: String(row[getIndex("Accounts Group")] ?? "").trim(),
      accountHead: String(row[getIndex("Accounts Head")] ?? "").trim(),
      voucherTypeRaw,
      voucherType: mapVoucherType(voucherTypeRaw),
      paymentMode: String(row[getIndex("Payment Mode")] ?? "").trim(),
      receipts: Number(row[getIndex("Receipts")] ?? 0),
      payments: Number(row[getIndex("Payments")] ?? 0),
      description: String(row[getIndex("Description")] ?? "").trim(),
      month: String(row[getIndex("Month")] ?? "").trim(),
      valid: true,
      errors: [],
    }
    const validation = validateVoucher(item)
    return {
      ...item,
      valid: validation.valid,
      errors: validation.errors,
    }
  })

  return parsed.filter((row) => row.voucherNo || row.accountHead || row.description)
}

export async function importVouchers(clientId: string, fiscalYearId: string, vouchers: ParsedVoucher[]): Promise<ImportResult> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error("Session expired. Please sign in again.")
  }

  const response = await fetch(`/api/clients/${clientId}/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      fiscalYearId,
      vouchers,
    }),
  })

  const result = (await response.json().catch(() => null)) as ImportResult | { error?: string } | null
  if (!response.ok || !result || "error" in result) {
    throw new Error((result as { error?: string } | null)?.error ?? "Import failed.")
  }

  return result as ImportResult
}
