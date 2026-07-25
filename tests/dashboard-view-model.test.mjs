import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadModule({ sourcePath, outputName, replacements = [] }) {
  let source = await readFile(sourcePath, "utf8")

  for (const [searchValue, replaceValue] of replacements) {
    source = source.replace(searchValue, replaceValue)
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempRoot = path.resolve(".tmp-test-artifacts")
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, "dashboard-view-model-"))
  const modulePath = path.join(tempDir, outputName)
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

function trialRow(overrides = {}) {
  return {
    accountHeadId: "head-1",
    accountHeadName: "Account",
    groupType: "asset",
    groupName: "Assets",
    semiSubGroupName: "Current Assets",
    subGroupName: "Current Assets",
    path: ["Assets", "Current Assets", "Current Assets", "Account"],
    openingBalance: 0,
    balanceType: "debit",
    totalDebit: 0,
    totalCredit: 0,
    debit: 0,
    credit: 0,
    balanceLabel: "0.00 Dr",
    ...overrides,
  }
}

const dashboardPeriod = await loadModule({
  sourcePath: path.resolve("lib/dashboard/dashboard-period.ts"),
  outputName: "dashboard-period.mjs",
})

const dashboardViewModel = await loadModule({
  sourcePath: path.resolve("lib/dashboard/get-organization-dashboard.ts"),
  outputName: "get-organization-dashboard.mjs",
  replacements: [
    ['import { createClient } from "@/lib/supabase/server"\n', "const createClient = async () => ({})\n"],
    ['import { getCurrentDateInAppTimeZone } from "@/lib/dates/current-date"\n', 'const getCurrentDateInAppTimeZone = () => "2026-07-24"\n'],
    [
      'import { calculateTrialBalance, type TrialBalanceRow } from "@/lib/accounting/trial-balance"\n',
      "const calculateTrialBalance = async () => ({ accounts: [] })\n",
    ],
    ['import { getClientTypeLabel } from "@/lib/accounting/clients"\n', 'const getClientTypeLabel = () => "Company"\n'],
    ['import { buildClientPath } from "@/lib/routing/clients"\n', 'const buildClientPath = () => "/clients/demo"\n'],
    [
      'import { formatDashboardCurrency, formatDashboardPercent } from "@/lib/dashboard/dashboard-formatters"\n',
      'const formatDashboardCurrency = (value) => value == null ? "—" : `BDT ${value.toFixed(2)}`\nconst formatDashboardPercent = (value) => value == null ? "—" : `${value.toFixed(2)}%`\n',
    ],
    [
      'import { resolveDashboardPeriodSelection } from "@/lib/dashboard/dashboard-period"\n',
      'const resolveDashboardPeriodSelection = () => ({ key: "fiscal-year", label: "This Fiscal Year", startDate: "2026-07-01", endDate: "2026-07-24", maxDate: "2026-07-24", periodLabel: "This Fiscal Year", asOfLabel: "As of 24 Jul 2026", comparison: null, customRange: null, hadValidationIssue: false })\n',
    ],
  ],
})

const { resolveDashboardPeriodSelection } = dashboardPeriod
const { __dashboardTestUtils } = dashboardViewModel

test("custom ranges clamp to fiscal-year and current-date boundaries", () => {
  const result = resolveDashboardPeriodSelection({
    fiscalYear: {
      start_date: "2026-07-01",
      end_date: "2027-06-30",
    },
    requestedKey: "custom",
    requestedFrom: "2026-06-15",
    requestedTo: "2026-08-05",
    todayDate: "2026-07-24",
  })

  assert.equal(result.startDate, "2026-07-01")
  assert.equal(result.endDate, "2026-07-24")
  assert.equal(result.hadValidationIssue, true)
})

test("invalid custom ranges fall back to a safe fiscal-year window", () => {
  const result = resolveDashboardPeriodSelection({
    fiscalYear: {
      start_date: "2026-07-01",
      end_date: "2027-06-30",
    },
    requestedKey: "custom",
    requestedFrom: "2026-07-20",
    requestedTo: "2026-07-10",
    todayDate: "2026-07-24",
  })

  assert.equal(result.startDate, "2026-07-01")
  assert.equal(result.endDate, "2026-07-24")
  assert.equal(result.hadValidationIssue, true)
})

test("zero denominators stay unavailable instead of producing invalid percentages", () => {
  assert.equal(__dashboardTestUtils.safePercent(50, 0), null)

  const metric = __dashboardTestUtils.metricFromValue({
    key: "np-percent",
    label: "Net Profit %",
    value: null,
    formatter: (value) => (value == null ? "—" : `${value}%`),
    periodLabel: "This Fiscal Year",
    tooltip: "test",
    state: "unavailable",
  })

  assert.equal(metric.formattedValue, "—")
  assert.equal(metric.state, "unavailable")
})

test("canonical tax, vat, and cash-bank rows are recognized without fuzzy name matching", () => {
  assert.equal(
    __dashboardTestUtils.isTaxPayableRow(
      trialRow({
        groupType: "liability",
        accountHeadName: "Income Tax Payable",
      })
    ),
    true
  )
  assert.equal(
    __dashboardTestUtils.isVatPayableRow(
      trialRow({
        groupType: "liability",
        accountHeadName: "VAT Payable",
      })
    ),
    true
  )
  assert.equal(
    __dashboardTestUtils.isCashAndBankRow(
      trialRow({
        groupType: "asset",
        semiSubGroupName: "Current Assets",
        subGroupName: "Cash & Cash Equivalents",
        path: ["Assets", "Current Assets", "Cash & Cash Equivalents", "Cash in Hand"],
      })
    ),
    true
  )
})

test("expense categories roll up by canonical subgroup and keep percentage shares", () => {
  const categories = __dashboardTestUtils.buildExpenseCategories(
    [
      trialRow({
        accountHeadId: "exp-1",
        accountHeadName: "Basic Salary",
        groupType: "expense",
        semiSubGroupName: "General & Administrative Expenses (G&A)",
        subGroupName: "Salary & Employee Benefits",
        debit: 300,
      }),
      trialRow({
        accountHeadId: "exp-2",
        accountHeadName: "House Rent Allowance",
        groupType: "expense",
        semiSubGroupName: "General & Administrative Expenses (G&A)",
        subGroupName: "Salary & Employee Benefits",
        debit: 200,
      }),
      trialRow({
        accountHeadId: "exp-3",
        accountHeadName: "Loan Interest",
        groupType: "expense",
        semiSubGroupName: "Financial Expenses",
        subGroupName: "Financial Expenses",
        debit: 100,
      }),
    ],
    600
  )

  assert.equal(categories[0].label, "Salary & Employee Benefits")
  assert.equal(categories[0].amount, 500)
  assert.equal(categories[0].formattedShare, "83.33%")
  assert.equal(categories[1].label, "Financial Expenses")
  assert.equal(categories[1].amount, 100)
})

after(async () => {
  await Promise.all([dashboardPeriod.cleanup(), dashboardViewModel.cleanup()])
})
