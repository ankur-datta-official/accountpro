import { format, parseISO } from "date-fns"

import type { SalaryCertificateSnapshot } from "@/lib/accounting/salary-certificates"

type PdfPage = {
  content: string[]
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN_X = 50
const MARGIN_TOP = 60
const MARGIN_BOTTOM = 55

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function formatMoney(value: number) {
  return value.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
    }
    current = word
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

class PdfWriter {
  private readonly pages: PdfPage[] = [{ content: [] }]

  addPage() {
    this.pages.push({ content: [] })
  }

  get page() {
    return this.pages[this.pages.length - 1]
  }

  text(x: number, y: number, text: string, size = 11, bold = false, align: "left" | "center" | "right" = "left") {
    const escaped = escapePdfText(text)
    const estimatedWidth = text.length * size * 0.5
    const drawX =
      align === "center" ? x - estimatedWidth / 2 : align === "right" ? x - estimatedWidth : x
    const font = bold ? "/F2" : "/F1"
    const pdfY = PAGE_HEIGHT - y
    this.page.content.push(`BT ${font} ${size} Tf 1 0 0 1 ${drawX.toFixed(2)} ${pdfY.toFixed(2)} Tm (${escaped}) Tj ET`)
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    const pdfY1 = PAGE_HEIGHT - y1
    const pdfY2 = PAGE_HEIGHT - y2
    this.page.content.push(`${x1.toFixed(2)} ${pdfY1.toFixed(2)} m ${x2.toFixed(2)} ${pdfY2.toFixed(2)} l S`)
  }

  rect(x: number, y: number, width: number, height: number) {
    const pdfY = PAGE_HEIGHT - y - height
    this.page.content.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`)
  }

  build() {
    const objects: string[] = []
    const kids: number[] = []

    objects.push("<< /Type /Catalog /Pages 2 0 R >>")

    const pageCount = this.pages.length
    const pagesObjectIndex = 2

    for (let index = 0; index < pageCount; index += 1) {
      const pageObjectNumber = 3 + index * 2
      const contentObjectNumber = pageObjectNumber + 1
      kids.push(pageObjectNumber)
      const stream = this.pages[index].content.join("\n")
      objects.push(
        `<< /Type /Page /Parent ${pagesObjectIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R /F2 ${4 + pageCount * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
      )
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    }

    objects.splice(1, 0, `<< /Type /Pages /Count ${pageCount} /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] >>`)
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    let output = "%PDF-1.4\n"
    const offsets: number[] = [0]

    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(output.length)
      output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
    }

    const xrefStart = output.length
    output += `xref\n0 ${objects.length + 1}\n`
    output += "0000000000 65535 f \n"
    for (let index = 1; index < offsets.length; index += 1) {
      output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    return Buffer.from(output, "utf8")
  }
}

function drawWrappedParagraph(writer: PdfWriter, text: string, y: number) {
  const lines = wrapText(text, 92)
  let currentY = y
  for (const line of lines) {
    writer.text(MARGIN_X, currentY, line, 11)
    currentY += 16
  }
  return currentY
}

function drawTwoColumnTable(
  writer: PdfWriter,
  startY: number,
  rows: Array<[string, string]>,
  headers: [string, string]
) {
  const leftX = 90
  const col1Width = 250
  const col2Width = 170
  const rowHeight = 24
  const tableWidth = col1Width + col2Width
  const totalRows = rows.length + 1

  writer.rect(leftX, startY, tableWidth, rowHeight * totalRows)
  writer.line(leftX + col1Width, startY, leftX + col1Width, startY + rowHeight * totalRows)

  for (let index = 1; index < totalRows; index += 1) {
    writer.line(leftX, startY + rowHeight * index, leftX + tableWidth, startY + rowHeight * index)
  }

  writer.text(leftX + 10, startY + 16, headers[0], 11, true)
  writer.text(leftX + tableWidth - 10, startY + 16, headers[1], 11, true, "right")

  rows.forEach((row, index) => {
    const rowY = startY + rowHeight * (index + 1)
    writer.text(leftX + 10, rowY + 16, row[0], 11)
    writer.text(leftX + tableWidth - 10, rowY + 16, row[1], 11, false, "right")
  })

  return startY + rowHeight * totalRows + 24
}

function drawTaxTable(writer: PdfWriter, startY: number, rows: SalaryCertificateSnapshot["tax"]["records"]) {
  const leftX = 55
  const widths = [75, 80, 140, 120, 75]
  const headers = ["Challan Date", "Challan No", "Bank Name", "Branch Name", "Employee TDS"]
  const rowHeight = 22
  const tableWidth = widths.reduce((sum, width) => sum + width, 0)
  const totalRows = Math.max(rows.length, 1) + 1

  writer.rect(leftX, startY, tableWidth, rowHeight * totalRows)

  let cursorX = leftX
  for (let index = 0; index < widths.length - 1; index += 1) {
    cursorX += widths[index]
    writer.line(cursorX, startY, cursorX, startY + rowHeight * totalRows)
  }

  for (let index = 1; index < totalRows; index += 1) {
    writer.line(leftX, startY + rowHeight * index, leftX + tableWidth, startY + rowHeight * index)
  }

  cursorX = leftX
  headers.forEach((header, index) => {
    const align = index === headers.length - 1 ? "right" : "left"
    const textX = align === "right" ? cursorX + widths[index] - 8 : cursorX + 8
    writer.text(textX, startY + 15, header, 9, true, align as "left" | "right")
    cursorX += widths[index]
  })

  const renderRows = rows.length
    ? rows
    : [{ challanDate: "", challanNo: "", bankName: "", branchName: "", employeeTds: 0 }]

  renderRows.forEach((row, rowIndex) => {
    const values = [
      row.challanDate ? format(parseISO(row.challanDate), "dd-MM-yyyy") : "",
      row.challanNo,
      row.bankName,
      row.branchName,
      row.employeeTds ? formatMoney(row.employeeTds) : "",
    ]
    let rowX = leftX
    values.forEach((value, index) => {
      const align = index === values.length - 1 ? "right" : "left"
      const textX = align === "right" ? rowX + widths[index] - 8 : rowX + 8
      writer.text(textX, startY + rowHeight * (rowIndex + 1) + 15, value, 9, false, align as "left" | "right")
      rowX += widths[index]
    })
  })

  return startY + rowHeight * totalRows + 24
}

export function generateSalaryCertificatePdf(snapshot: SalaryCertificateSnapshot) {
  const writer = new PdfWriter()
  let y = MARGIN_TOP

  writer.text(PAGE_WIDTH / 2, y, "SALARY CERTIFICATE", 15, true, "center")
  y += 22
  writer.text(PAGE_WIDTH / 2, y, `Financial Year ${snapshot.fiscalYear.label}`, 12, true, "center")
  y += 18
  writer.text(PAGE_WIDTH / 2, y, `Assessment Year: ${snapshot.fiscalYear.assessmentYearLabel}`, 12, true, "center")
  y += 28

  writer.text(MARGIN_X, y, `Certificate No.: ${snapshot.certificateNo}`, 11, true)
  writer.text(PAGE_WIDTH - MARGIN_X, y, `Date: ${format(parseISO(snapshot.issueDate), "dd-MM-yyyy")}`, 11, true, "right")
  y += 30

  writer.text(PAGE_WIDTH / 2, y, "TO WHOM IT MAY CONCERN", 12, true, "center")
  writer.line(215, y + 4, 380, y + 4)
  y += 28

  y = drawWrappedParagraph(
    writer,
    `This is to certify that Mr./Ms. ${snapshot.employee.name}, Employee ID ${snapshot.employee.employeeCode ?? "N/A"}, has been employed with ${snapshot.client.tradeName ?? snapshot.client.name} as ${snapshot.employee.designation ?? "Employee"} since ${snapshot.employee.joiningDate ? format(parseISO(snapshot.employee.joiningDate), "dd MMMM yyyy") : "N/A"}. He/She is a permanent full-time employee of the Company.`,
    y
  )
  y += 6

  y = drawWrappedParagraph(
    writer,
    `This certificate is issued in respect of the employee's salary and related tax deductions for the Financial Year ${snapshot.fiscalYear.label}.`,
    y
  )
  y += 8

  writer.text(MARGIN_X, y, `The employee's annual salary structure for the Financial Year ${snapshot.fiscalYear.label} is as follows:`, 11)
  y += 18

  y = drawTwoColumnTable(
    writer,
    y,
    [
      ["Basic Salary", formatMoney(snapshot.salary.basic)],
      ["House Rent Allowance", formatMoney(snapshot.salary.houseRent)],
      ["Medical Allowance", formatMoney(snapshot.salary.medical)],
      ["Conveyance Allowance", formatMoney(snapshot.salary.conveyance)],
      ["Other Allowance", formatMoney(snapshot.salary.otherAllowance)],
      ["Gross Salary", formatMoney(snapshot.salary.gross)],
      ["Tax Deduction", formatMoney(snapshot.salary.taxDeduction)],
      ["Other Deduction", formatMoney(snapshot.salary.otherDeduction)],
      ["Net Salary", formatMoney(snapshot.salary.netSalary)],
    ],
    ["Salary Components", "Annual Amount (BDT)"]
  )

  if (y > PAGE_HEIGHT - 300) {
    writer.addPage()
    y = MARGIN_TOP
  }

  writer.text(MARGIN_X, y, "The employee's annual tax deduction details are as follows:", 11)
  y += 18
  y = drawTaxTable(writer, y, snapshot.tax.records)

  y = drawWrappedParagraph(
    writer,
    "The above information has been verified against the official payroll, accounting and tax records of the Company and is certified to be true, correct and complete to the best of our knowledge and belief.",
    y
  )
  y += 8
  y = drawWrappedParagraph(
    writer,
    "Issued at the request of the employee for submission to the concerned authority for official purposes.",
    y
  )

  const signatureY = Math.max(y + 40, PAGE_HEIGHT - MARGIN_BOTTOM - 70)
  writer.text(MARGIN_X, signatureY, `On behalf of ${snapshot.client.tradeName ?? snapshot.client.name}`, 11, true)
  writer.text(MARGIN_X, signatureY + 22, "Authorized Signatory", 11, true)

  return writer.build()
}
