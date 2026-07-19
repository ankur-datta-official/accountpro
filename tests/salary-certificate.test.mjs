import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function transpileToModule(sourcePath, targetName) {
  const source = await readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempRoot = path.resolve(".tmp-test-artifacts", "salary-certificate-tests")
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, "run-"))
  const modulePath = path.join(tempDir, targetName)
  await writeFile(modulePath, transpiled, "utf8")
  return {
    module: await import(pathToFileURL(modulePath).href),
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const accountingModule = await transpileToModule(
  path.resolve("lib/accounting/salary-certificates.ts"),
  "salary-certificates.mjs"
)
const pdfModule = await transpileToModule(
  path.resolve("lib/utils/pdf/salary-certificate-pdf.ts"),
  "salary-certificate-pdf.mjs"
)

const {
  aggregateAnnualPayroll,
  buildAssessmentYearLabel,
  buildSalaryCertificateNumber,
  getFiscalYearMonthKeys,
  validateSalaryCertificateLifecycle,
} = accountingModule.module
const { generateSalaryCertificatePdf } = pdfModule.module

function buildYearlyRuns(overrides = {}) {
  const months = [
    ["2025-07-01", "2025-07-31", "Jul-2025"],
    ["2025-08-01", "2025-08-31", "Aug-2025"],
    ["2025-09-01", "2025-09-30", "Sep-2025"],
    ["2025-10-01", "2025-10-31", "Oct-2025"],
    ["2025-11-01", "2025-11-30", "Nov-2025"],
    ["2025-12-01", "2025-12-31", "Dec-2025"],
    ["2026-01-01", "2026-01-31", "Jan-2026"],
    ["2026-02-01", "2026-02-28", "Feb-2026"],
    ["2026-03-01", "2026-03-31", "Mar-2026"],
    ["2026-04-01", "2026-04-30", "Apr-2026"],
    ["2026-05-01", "2026-05-31", "May-2026"],
    ["2026-06-01", "2026-06-30", "Jun-2026"],
  ]

  return months.map(([periodStart, periodEnd, periodLabel], index) => ({
    id: `run-${index + 1}`,
    periodStart,
    periodEnd,
    periodLabel,
    paymentVoucherNo: index + 1,
    paymentVoucherDate: periodEnd,
    paymentModeName: "Agrani Bank PLC",
    items: [
      {
        employeeId: "emp-1",
        employeeName: overrides.employeeName ?? "D.K. Staff",
        designation: overrides.designation ?? "Accounts Officer",
        components: [
          { code: "basic", amount: 10000 },
          { code: "housing", amount: 4000 },
          { code: "medical", amount: 1500 },
          { code: "conveyance", amount: 500 },
          { code: "bonus", amount: 1000 },
          { code: "tax", amount: 1200 },
          { code: "staff_pf", amount: 300 },
        ],
      },
    ],
  }))
}

test("annual payroll aggregation totals the selected employee for the full fiscal year", () => {
  const result = aggregateAnnualPayroll({
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "D.K. Staff",
    designation: "Accounts Officer",
    joiningDate: "2024-07-01",
    fiscalYearLabel: "2025-2026",
    fiscalYearStart: "2025-07-01",
    fiscalYearEnd: "2026-06-30",
    runs: buildYearlyRuns(),
  })

  assert.equal(result.ok, true)
  assert.equal(result.snapshotPayload.salary.basic, 120000)
  assert.equal(result.snapshotPayload.salary.otherAllowance, 12000)
  assert.equal(result.snapshotPayload.salary.netSalary, 186000)
})

test("TDS aggregation preserves each monthly row and the annual total", () => {
  const result = aggregateAnnualPayroll({
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "D.K. Staff",
    designation: "Accounts Officer",
    joiningDate: "2024-07-01",
    fiscalYearLabel: "2025-2026",
    fiscalYearStart: "2025-07-01",
    fiscalYearEnd: "2026-06-30",
    runs: buildYearlyRuns(),
  })

  assert.equal(result.ok, true)
  assert.equal(result.snapshotPayload.tax.employeeTds, 14400)
  assert.equal(result.snapshotPayload.tax.records.length, 12)
  assert.equal(result.snapshotPayload.tax.records[0].challanNo, "1")
})

test("certificate number generation follows SAL/FY/running-number format", () => {
  assert.equal(buildSalaryCertificateNumber({ fiscalYearLabel: "2025-2026", sequence: 2 }), "SAL/2025-2026/002")
})

test("snapshot data remains immutable after newer employee details change", () => {
  const historical = aggregateAnnualPayroll({
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "Old Name",
    designation: "Accounts Officer",
    joiningDate: "2024-07-01",
    fiscalYearLabel: "2025-2026",
    fiscalYearStart: "2025-07-01",
    fiscalYearEnd: "2026-06-30",
    runs: buildYearlyRuns({ employeeName: "Old Name" }),
  })
  const regenerated = aggregateAnnualPayroll({
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "New Name",
    designation: "Senior Accounts Officer",
    joiningDate: "2024-07-01",
    fiscalYearLabel: "2025-2026",
    fiscalYearStart: "2025-07-01",
    fiscalYearEnd: "2026-06-30",
    runs: buildYearlyRuns({ employeeName: "New Name", designation: "Senior Accounts Officer" }),
  })

  assert.equal(historical.ok, true)
  assert.equal(regenerated.ok, true)
  assert.equal(historical.snapshotPayload.employeeName, "Old Name")
  assert.equal(regenerated.snapshotPayload.employeeName, "New Name")
})

test("closed fiscal years reject certificate mutation", () => {
  const result = validateSalaryCertificateLifecycle({
    operation: "generate",
    status: "draft",
    isFiscalYearClosed: true,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /immutable/i)
})

test("partial payroll coverage still generates from available months", () => {
  const runs = buildYearlyRuns().slice(0, 10)
  const result = aggregateAnnualPayroll({
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "D.K. Staff",
    designation: "Accounts Officer",
    joiningDate: "2024-07-01",
    fiscalYearLabel: "2025-2026",
    fiscalYearStart: "2025-07-01",
    fiscalYearEnd: "2026-06-30",
    runs,
  })

  assert.equal(result.ok, true)
  assert.equal(result.snapshotPayload.salary.basic, 100000)
  assert.equal(result.snapshotPayload.salary.netSalary, 155000)
  assert.deepEqual(result.snapshotPayload.payrollCoverage.missingMonths, ["2026-05", "2026-06"])
  assert.deepEqual(result.snapshotPayload.payrollCoverage.coveredMonths, [
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
  ])
})

test("issued certificate lock prevents regeneration", () => {
  const result = validateSalaryCertificateLifecycle({
    operation: "generate",
    status: "issued",
    isFiscalYearClosed: false,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /immutable/i)
})

test("assessment year label advances both fiscal year ends", () => {
  assert.equal(buildAssessmentYearLabel("2025-2026"), "2026-2027")
})

test("fiscal year month coverage produces all 12 month keys", () => {
  assert.deepEqual(getFiscalYearMonthKeys("2025-07-01", "2026-06-30"), [
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
  ])
})

test("PDF generation returns a valid PDF payload", () => {
  const pdf = generateSalaryCertificatePdf({
    certificateNo: "SAL/2025-2026/001",
    issueDate: "2026-07-19",
    generatedAt: "2026-07-19T08:00:00.000Z",
    client: {
      id: "client-1",
      name: "ABC Company",
      tradeName: "ABC Company",
      address: "Dhaka",
      phone: null,
      email: null,
      tin: null,
      bin: null,
    },
    fiscalYear: {
      id: "fy-1",
      label: "2025-2026",
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      assessmentYearLabel: "2026-2027",
    },
    employee: {
      id: "emp-1",
      employeeCode: "E-001",
      name: "D.K. Staff",
      designation: "Accounts Officer",
      joiningDate: "2024-07-01",
    },
    salary: {
      basic: 120000,
      houseRent: 48000,
      medical: 18000,
      conveyance: 6000,
      otherAllowance: 12000,
      gross: 204000,
      taxDeduction: 14400,
      otherDeduction: 3600,
      netSalary: 186000,
    },
    tax: {
      employeeTds: 14400,
      records: [
        {
          challanDate: "2025-07-31",
          challanNo: "1",
          bankName: "Agrani Bank PLC",
          branchName: "",
          employeeTds: 1200,
        },
      ],
    },
    payrollCoverage: {
      expectedMonths: ["2025-07"],
      coveredMonths: ["2025-07"],
      missingMonths: [],
    },
  })

  assert.equal(Buffer.isBuffer(pdf), true)
  assert.match(pdf.toString("utf8", 0, 8), /%PDF-1.4/)
})

after(async () => {
  await accountingModule.cleanup()
  await pdfModule.cleanup()
})
