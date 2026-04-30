import { format } from "date-fns"
import * as XLSX from "xlsx"

import type { BankStatementResult } from "@/lib/accounting/bank-statement"
import type { ComparativeBalanceSheet } from "@/lib/accounting/balance-sheet"
import type { ProfitLossResult } from "@/lib/accounting/profit-loss"
import type { TrialBalanceRow } from "@/lib/accounting/trial-balance"

type CellStyle = XLSX.CellObject["s"]

function styleCell(ws: XLSX.WorkSheet, cell: string, style: CellStyle) {
  if (!ws[cell]) return
  ws[cell].s = style
}

function autoDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function workbookToBlob(workbook: XLSX.WorkBook) {
  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true })
  return new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

export type DayBookExportRow = {
  voucherNo: number
  date: string
  accountsGroup: string
  semiSubGroup: string
  subGroup: string
  accountHead: string
  voucherType: string
  paymentMode: string
  receipt: number
  payment: number
  description: string
  month: string
}

export function exportDayBook(
  data: DayBookExportRow[],
  clientName: string,
  period: string | { from: string; to: string }
): Blob {
  const periodLabel = typeof period === "string" ? period : `${period.from} to ${period.to}`
  const rows: Array<Array<string | number>> = [
    ["Day Book"],
    [clientName],
    [`Period: ${periodLabel}`],
    [],
    ["Voucher #", "Date", "Accounts Group", "Accounts Head", "Voucher Type", "Payment Mode", "Receipts", "Payments", "Description", "Month"],
    ...data.map((row) => [
      row.voucherNo,
      row.date,
      row.accountsGroup,
      row.accountHead,
      row.voucherType,
      row.paymentMode,
      row.receipt,
      row.payment,
      row.description,
      row.month,
    ]),
  ]

  const totalReceipts = data.reduce((sum, row) => sum + row.receipt, 0)
  const totalPayments = data.reduce((sum, row) => sum + row.payment, 0)
  rows.push(["", "", "", "", "", "Total", totalReceipts, totalPayments, "", ""])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 34 }, { wch: 12 }]

  styleCell(ws, "A1", { font: { bold: true, sz: 16 } })
  styleCell(ws, "A2", { font: { bold: true, sz: 12 } })
  styleCell(ws, "A3", { font: { bold: true } })

  for (let col = 0; col < 10; col += 1) {
    const cell = XLSX.utils.encode_cell({ c: col, r: 4 })
    styleCell(ws, cell, { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
  }

  for (let rowIndex = 5; rowIndex < 5 + data.length; rowIndex += 1) {
    if ((rowIndex - 5) % 2 !== 0) continue
    for (let col = 0; col < 10; col += 1) {
      const cell = XLSX.utils.encode_cell({ c: col, r: rowIndex })
      styleCell(ws, cell, { fill: { fgColor: { rgb: "F8FAFC" } } })
    }
  }

  const totalRowIndex = 5 + data.length
  for (let col = 0; col < 10; col += 1) {
    const cell = XLSX.utils.encode_cell({ c: col, r: totalRowIndex })
    styleCell(ws, cell, { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Home")
  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-day-book`)
  return blob
}

export type LedgerExportSection = {
  accountName: string
  groupName: string
  period: string
  openingBalance: string
  rows: Array<{
    date: string
    voucherNo: number
    voucherType: string
    paymentMode: string
    description: string
    debit: number
    credit: number
    balance: string
  }>
  totalDebit: number
  totalCredit: number
  closingBalance: string
}

export function exportLedger(data: LedgerExportSection[], clientName: string, period: string): Blob {
  const wb = XLSX.utils.book_new()

  for (const section of data) {
    const rows: Array<Array<string | number>> = [
      ["Ledger"],
      [clientName],
      [`Account: ${section.accountName}`],
      [`Group: ${section.groupName}`],
      [`Period: ${period || section.period}`],
      [`Opening Balance: ${section.openingBalance}`],
      [],
      ["Date", "Voucher #", "Type", "Payment Mode", "Description", "Debit", "Credit", "Balance"],
      ...section.rows.map((entry) => [entry.date, entry.voucherNo, entry.voucherType, entry.paymentMode, entry.description, entry.debit, entry.credit, entry.balance]),
      ["", "", "", "", "Total", section.totalDebit, section.totalCredit, section.closingBalance],
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
    const totalRow = rows.length - 1
    for (let c = 0; c < 8; c += 1) {
      styleCell(ws, XLSX.utils.encode_cell({ c, r: 7 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
      styleCell(ws, XLSX.utils.encode_cell({ c, r: totalRow }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
    }
    XLSX.utils.book_append_sheet(wb, ws, section.accountName.slice(0, 31) || "Ledger")
  }

  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-ledger-book`)
  return blob
}

export function exportTrialBalance(
  dataOrPayload:
    | TrialBalanceRow[]
    | {
        clientName: string
        fiscalYearLabel?: string
        periodLabel?: string
        rows: TrialBalanceRow[]
        [key: string]: unknown
      },
  clientNameArg?: string,
  periodArg?: string
): Blob {
  const rowsInput = Array.isArray(dataOrPayload) ? dataOrPayload : dataOrPayload.rows
  const clientName = Array.isArray(dataOrPayload) ? clientNameArg ?? "Client" : dataOrPayload.clientName
  const period = Array.isArray(dataOrPayload) ? periodArg ?? "" : dataOrPayload.periodLabel ?? periodArg ?? ""
  const grouped = rowsInput.reduce<Record<string, TrialBalanceRow[]>>((acc, row) => {
    if (!acc[row.semiSubGroupName]) acc[row.semiSubGroupName] = []
    acc[row.semiSubGroupName].push(row)
    return acc
  }, {})

  const rows: Array<Array<string | number>> = [["Trial Balance"], [clientName], [`Period: ${period}`], [], ["Group", "Account Head", "Debit", "Credit", "Balance"]]

  for (const [groupName, groupRows] of Object.entries(grouped)) {
    rows.push([groupName, "", "", "", ""])
    for (const row of groupRows) {
      rows.push(["", row.accountHeadName, row.debit, row.credit, row.balanceLabel])
    }
  }

  const totalDebit = rowsInput.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = rowsInput.reduce((sum, row) => sum + row.credit, 0)
  rows.push(["", "Grand Total", totalDebit, totalCredit, ""])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 26 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
  for (let c = 0; c < 5; c += 1) {
    styleCell(ws, XLSX.utils.encode_cell({ c, r: 4 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
    styleCell(ws, XLSX.utils.encode_cell({ c, r: rows.length - 1 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "TB")
  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-trial-balance`)
  return blob
}

export function exportBalanceSheet(
  arg1: ComparativeBalanceSheet | string,
  arg2: ComparativeBalanceSheet | string,
  arg3?: string
): Blob {
  const data = typeof arg1 === "string" ? (arg2 as ComparativeBalanceSheet) : arg1
  const clientName = typeof arg1 === "string" ? arg1 : (arg2 as string)
  const period = arg3 ?? data.current.fiscalYearLabel
  const rows: Array<Array<string | number>> = [
    ["Balance Sheet"],
    [clientName],
    [`Period: ${period}`],
    [],
    ["Assets", "Amount", "Liabilities", "Amount"],
  ]

  const assetRows = [
    ...data.current.assets.nonCurrentAssets.lines.map((line) => [line.label, line.amount]),
    ...data.current.assets.currentAssets.lines.map((line) => [line.label, line.amount]),
    ...data.current.assets.preliminaryExpenses.lines.map((line) => [line.label, line.amount]),
    ["Total Assets", data.current.assets.totalAssets],
  ]
  const liabilityRows = [
    ...data.current.liabilitiesEquity.equity.lines.map((line) => [line.label, line.amount]),
    ...data.current.liabilitiesEquity.nonCurrentLiabilities.lines.map((line) => [line.label, line.amount]),
    ...data.current.liabilitiesEquity.currentLiabilities.lines.map((line) => [line.label, line.amount]),
    ["Total Liabilities & Equity", data.current.liabilitiesEquity.totalLiabilitiesEquity],
  ]
  const maxLen = Math.max(assetRows.length, liabilityRows.length)
  for (let i = 0; i < maxLen; i += 1) {
    rows.push([assetRows[i]?.[0] ?? "", assetRows[i]?.[1] ?? "", liabilityRows[i]?.[0] ?? "", liabilityRows[i]?.[1] ?? ""])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 34 }, { wch: 16 }]
  for (let c = 0; c < 4; c += 1) {
    styleCell(ws, XLSX.utils.encode_cell({ c, r: 4 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet")
  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-balance-sheet`)
  return blob
}

export function exportBankStatement(
  data: BankStatementResult,
  bankOrRange: string | { fromDate: string; toDate: string },
  clientNameArg?: string,
  periodArg?: string
): Blob {
  const bankName = typeof bankOrRange === "string" ? bankOrRange : data.paymentModeName
  const clientName = clientNameArg ?? "Client"
  const period = typeof bankOrRange === "string" ? periodArg ?? "" : `${bankOrRange.fromDate} to ${bankOrRange.toDate}`
  const grouped = data.rows.reduce<Record<string, typeof data.rows>>((acc, row) => {
    if (!acc[row.accountHead]) acc[row.accountHead] = []
    acc[row.accountHead].push(row)
    return acc
  }, {})

  const rows: Array<Array<string | number>> = [
    ["Bank Statement"],
    [clientName],
    [`Bank: ${bankName}`],
    [`Period: ${period}`],
    [],
    ["Date", "Voucher #", "Account Head", "Description", "Debit", "Credit", "Balance"],
    ["", "", "", "Opening Balance", "", "", data.openingBalance],
  ]

  for (const [head, headRows] of Object.entries(grouped)) {
    rows.push(["", "", head, "", "", "", ""])
    for (const row of headRows) {
      rows.push([row.date, row.voucherNo, row.accountHead, row.description, row.debit, row.credit, row.runningBalance])
    }
    rows.push(["", "", "", "Subtotal", headRows.reduce((s, r) => s + r.debit, 0), headRows.reduce((s, r) => s + r.credit, 0), ""])
  }
  rows.push(["", "", "", "Grand Total", data.totalDebit, data.totalCredit, data.closingBalance])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  for (let c = 0; c < 7; c += 1) {
    styleCell(ws, XLSX.utils.encode_cell({ c, r: 5 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
    styleCell(ws, XLSX.utils.encode_cell({ c, r: rows.length - 1 }), { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } })
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Bank")
  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-${bankName}-bank-statement`)
  return blob
}

export function downloadExcelBlob(blob: Blob, filenamePrefix: string) {
  autoDownload(blob, `${filenamePrefix}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`)
}

export function exportProfitLoss(clientName: string, data: ProfitLossResult): Blob {
  const rows: Array<Array<string | number>> = [
    ["Profit & Loss"],
    [clientName],
    [`Year Ended: ${data.endDate}`],
    [],
    ["Particulars", "Amount"],
    ["Revenue Income", ""],
    ...data.revenueItems.map((item) => [item.name, item.amount]),
    ["Total Revenue", data.totalRevenue],
    ["", ""],
    ["Other Income", ""],
    ...data.otherIncomeItems.map((item) => [item.name, item.amount]),
    ["Total Other Income", data.totalOtherIncome],
    ["", ""],
    ["General & Administrative Expenses", ""],
    ...data.adminExpenseItems.map((item) => [item.name, item.amount]),
    ["Revenue Expenses", ""],
    ...data.revenueExpenseItems.map((item) => [item.name, item.amount]),
    ["Total Expenses", data.totalExpenses],
    ["Net Profit/(Loss)", data.netProfit],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{ wch: 48 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "ProfitLoss")
  const blob = workbookToBlob(wb)
  downloadExcelBlob(blob, `${clientName}-profit-loss`)
  return blob
}

// backward-compatible wrappers used in existing components
export function exportLedgerBook(sections: LedgerExportSection[], clientName: string): void {
  exportLedger(sections, clientName, sections[0]?.period ?? "")
}
