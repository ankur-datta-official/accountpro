"use client"

import { forwardRef } from "react"
import { format } from "date-fns"

import type { PayrollExportRow } from "@/lib/utils/excel-export"

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatText(value: string | null | undefined) {
  return value?.trim() || "-"
}

function formatFiscalYearLabel(label: string) {
  if (!label) return "-"
  return /^FY\b/i.test(label) ? label : `FY ${label}`
}

const columnLabels = [
  "Employee Code",
  "Employee Name",
  "Designation",
  "Grade",
  "Basic",
  "Housing",
  "Medical",
  "Conveyance",
  "SubTotal",
  "PF Org Part",
  "Bonus",
  "Arrear",
  "Total Salary",
  "PF Org+Staff",
  "Loan Installment",
  "Loan Interest",
  "Tax",
  "Net Payable",
] as const

export const PayrollSalarySheetPrint = forwardRef<
  HTMLDivElement,
  {
    companyName: string
    fiscalYearLabel: string
    payrollRunLabel: string
    showFooter?: boolean
    rows: PayrollExportRow[]
    totals: {
      subTotal: number
      totalSalary: number
      totalDeductions: number
      netPay: number
      basic: number
      housing: number
      medical: number
      conveyance: number
      pfOrgPart: number
      bonus: number
      arrear: number
      pfTotal: number
      loanInstallment: number
      loanInterest: number
      tax: number
    }
    printedDate?: string
  }
>(function PayrollSalarySheetPrint(
  { companyName, fiscalYearLabel, payrollRunLabel, rows, totals, printedDate, showFooter = false },
  ref
) {
  const displayFiscalYear = formatFiscalYearLabel(fiscalYearLabel)
  const printDate = printedDate ?? format(new Date(), "dd MMM yyyy")

  return (
    <div ref={ref} className="payroll-print-root bg-white text-black">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .payroll-print-root {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }

          .payroll-print-table thead {
            display: table-header-group;
          }

          .payroll-print-table tfoot {
            display: table-row-group;
          }

          .payroll-print-row,
          .payroll-print-row th,
          .payroll-print-row td {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .vertical-header {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
          }
        }

        .vertical-header {
          display: inline-block;
          white-space: nowrap;
          line-height: 1;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
      `}</style>

      <div className="mx-auto w-full max-w-[277mm] bg-white px-1 py-1">
        <header className="text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-black">
            {companyName || "Organization"}
          </h1>
          <p className="mt-1 text-lg font-bold uppercase tracking-[0.18em] text-black">
            PAYROLL SALARY SHEET
          </p>
          <p className="mt-1 text-sm font-semibold text-black">
            Payroll Run: {payrollRunLabel} | {displayFiscalYear}
          </p>
        </header>

        <div className="mt-4 overflow-hidden border border-black">
          <table className="payroll-print-table w-full table-fixed border-collapse text-[10px] leading-tight">
            <colgroup>
              <col style={{ width: "11mm" }} />
              <col style={{ width: "32mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "10mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "16mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "14mm" }} />
              <col style={{ width: "16mm" }} />
            </colgroup>
            <thead>
              <tr className="payroll-print-row">
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold" colSpan={4}>
                  Employee Details
                </th>
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold" colSpan={5}>
                  Monthly Salary
                </th>
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold" colSpan={3}>
                  Additions
                </th>
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold">
                  Total Salary
                </th>
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold" colSpan={4}>
                  Deductions
                </th>
                <th className="border-b border-r border-black px-1 py-1 text-center font-bold">
                  Net Payable
                </th>
              </tr>
              <tr className="payroll-print-row">
                {columnLabels.map((label) => (
                  <th
                    key={label}
                    className="border-b border-r border-black px-1 py-0 text-center font-semibold align-middle"
                    style={{ height: "34mm" }}
                  >
                    <span className="vertical-header text-[9px]">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.employeeCode ?? row.staffName}-${index}`} className="payroll-print-row">
                  <td className="border-b border-r border-black px-1 py-1 text-center">{formatText(row.employeeCode)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-left whitespace-normal break-words">{formatText(row.staffName)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-center whitespace-normal break-words">{formatText(row.designation)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-center">{formatText(row.grade)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.basic)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.housing)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.medical)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.conveyance)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right font-semibold">{formatAmount(row.subTotal)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.pfOrgPart)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.bonus)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.arrear)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right font-semibold">{formatAmount(row.totalSalary)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.pfTotal)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.loanInstallment)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.loanInterest)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right">{formatAmount(row.tax)}</td>
                  <td className="border-b border-r border-black px-1 py-1 text-right font-semibold">{formatAmount(row.netPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="payroll-print-row border-t border-black font-bold">
                <td className="border-r border-black px-1 py-1 text-center" colSpan={4}>
                  Grand Total
                </td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.basic)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.housing)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.medical)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.conveyance)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.subTotal)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.pfOrgPart)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.bonus)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.arrear)}</td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.totalSalary)}</td>
                <td className="border-r border-black px-1 py-1 text-right" colSpan={4}>
                  Total Deductions: {formatAmount(totals.totalDeductions)}
                </td>
                <td className="border-r border-black px-1 py-1 text-right">{formatAmount(totals.netPay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {showFooter ? (
          <footer className="mt-6 grid grid-cols-3 gap-6 text-sm text-black">
            <div className="pt-8 text-center">
              <div className="border-t border-black pt-2 font-medium">Prepared By</div>
            </div>
            <div className="pt-8 text-center">
              <div className="border-t border-black pt-2 font-medium">Approved By</div>
            </div>
            <div className="pt-8 text-center">
              <div className="border-t border-black pt-2 font-medium">Date: {printDate}</div>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  )
})

PayrollSalarySheetPrint.displayName = "PayrollSalarySheetPrint"
