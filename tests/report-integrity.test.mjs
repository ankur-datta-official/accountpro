import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
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

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "report-integrity-"))
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
    accountHeadId: "head",
    accountHeadName: "Account",
    groupType: "asset",
    groupName: "Assets",
    subGroupName: undefined,
    semiSubGroupName: undefined,
    path: ["Assets", "Account"],
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

const balanceSheet = await loadModule({
  sourcePath: path.resolve("lib/accounting/balance-sheet.ts"),
  outputName: "balance-sheet.mjs",
  replacements: [
    [
      'import { calculateTrialBalance, type TrialBalanceRow } from "@/lib/accounting/trial-balance"',
      "const calculateTrialBalance = async () => ({ accounts: [] })",
    ],
  ],
})

const bankStatement = await loadModule({
  sourcePath: path.resolve("lib/accounting/bank-statement.ts"),
  outputName: "bank-statement.mjs",
  replacements: [
    [
      'import { resolveMappedPaymentModeAccount, type PaymentModeAccountHead } from "@/lib/accounting/payment-modes"',
      "const resolveMappedPaymentModeAccount = ({ clientId, paymentMode, accountHeads }) => {\n  if (!paymentMode.account_head_id) {\n    return { ok: false, error: 'The selected payment mode is not mapped to an account head.' }\n  }\n  const accountHead = accountHeads.find((head) => head.id === paymentMode.account_head_id) ?? null\n  if (!accountHead || accountHead.client_id !== clientId || accountHead.is_active === false || accountHead.type !== 'asset') {\n    return { ok: false, error: 'The selected payment mode must be linked to an active same-client cash or bank asset account.' }\n  }\n  return { ok: true, accountHead }\n}"
    ],
  ],
})

const { buildStatementFromRows } = balanceSheet
const { buildBankStatementResult } = bankStatement

test("profit is included exactly once in equity", () => {
  const statement = buildStatementFromRows(
    [
      trialRow({
        accountHeadId: "cash",
        accountHeadName: "Cash",
        groupType: "asset",
        debit: 175,
        balanceLabel: "175.00 Dr",
      }),
      trialRow({
        accountHeadId: "capital",
        accountHeadName: "Share Capital",
        groupType: "liability",
        balanceType: "credit",
        credit: 100,
        balanceLabel: "100.00 Cr",
      }),
      trialRow({
        accountHeadId: "sales",
        accountHeadName: "Sales",
        groupType: "income",
        balanceType: "credit",
        credit: 70,
        balanceLabel: "70.00 Cr",
      }),
      trialRow({
        accountHeadId: "rent",
        accountHeadName: "Rent Expense",
        groupType: "expense",
        debit: 20,
        balanceLabel: "20.00 Dr",
      }),
    ],
    { id: "fy-1", label: "FY 2026", end_date: "2026-12-31" },
    25
  )

  assert.equal(statement.openingRetainedEarnings, 25)
  assert.equal(statement.netProfitLoss, 50)
  assert.equal(statement.retainedEarnings, 75)
  assert.equal(
    statement.liabilitiesEquity.equity.lines.find((line) => line.label === "Retained Earnings")?.amount,
    25
  )
  assert.equal(
    statement.liabilitiesEquity.equity.lines.find((line) => line.label === "Current Year Net Profit")?.amount,
    50
  )
  assert.equal(statement.liabilitiesEquity.equity.total, 175)
})

test("loss is included exactly once in equity with correct sign", () => {
  const statement = buildStatementFromRows(
    [
      trialRow({
        accountHeadId: "cash",
        accountHeadName: "Cash",
        groupType: "asset",
        debit: 110,
        balanceLabel: "110.00 Dr",
      }),
      trialRow({
        accountHeadId: "capital",
        accountHeadName: "Share Capital",
        groupType: "liability",
        balanceType: "credit",
        credit: 100,
        balanceLabel: "100.00 Cr",
      }),
      trialRow({
        accountHeadId: "salary",
        accountHeadName: "Salary Expense",
        groupType: "expense",
        debit: 30,
        balanceLabel: "30.00 Dr",
      }),
    ],
    { id: "fy-2", label: "FY 2027", end_date: "2027-12-31" },
    40
  )

  assert.equal(statement.openingRetainedEarnings, 40)
  assert.equal(statement.netProfitLoss, -30)
  assert.equal(statement.retainedEarnings, 10)
  assert.equal(
    statement.liabilitiesEquity.equity.lines.find((line) => line.label === "Current Year Net Loss")?.amount,
    -30
  )
  assert.equal(statement.liabilitiesEquity.equity.total, 110)
})

test("balance-sheet equation stays intact without artificial balancing lines", () => {
  const statement = buildStatementFromRows(
    [
      trialRow({
        accountHeadId: "cash",
        accountHeadName: "Cash",
        groupType: "asset",
        debit: 200,
        balanceLabel: "200.00 Dr",
      }),
      trialRow({
        accountHeadId: "inventory",
        accountHeadName: "Inventory",
        groupType: "asset",
        debit: 20,
        balanceLabel: "20.00 Dr",
      }),
      trialRow({
        accountHeadId: "capital",
        accountHeadName: "Share Capital",
        groupType: "liability",
        balanceType: "credit",
        credit: 150,
        balanceLabel: "150.00 Cr",
      }),
      trialRow({
        accountHeadId: "payable",
        accountHeadName: "Accounts Payable",
        groupType: "liability",
        balanceType: "credit",
        credit: 20,
        balanceLabel: "20.00 Cr",
      }),
      trialRow({
        accountHeadId: "income",
        accountHeadName: "Service Income",
        groupType: "income",
        balanceType: "credit",
        credit: 40,
        balanceLabel: "40.00 Cr",
      }),
      trialRow({
        accountHeadId: "expense",
        accountHeadName: "Office Expense",
        groupType: "expense",
        debit: 10,
        balanceLabel: "10.00 Dr",
      }),
    ],
    { id: "fy-3", label: "FY 2028", end_date: "2028-12-31" },
    20
  )

  assert.equal(statement.assets.totalAssets, statement.liabilitiesEquity.totalLiabilitiesEquity)
  assert.equal(
    statement.liabilitiesEquity.equity.lines.some((line) => /balancing|difference|suspense/i.test(line.label)),
    false
  )
})

test("bank statement keeps only the selected bank account leg and excludes counter-entries", () => {
  const result = buildBankStatementResult({
    paymentModeName: "Dutch Bangla Bank",
    accountHead: {
      id: "bank-1",
      client_id: "client-1",
      name: "Dutch Bangla Bank",
      opening_balance: 1000,
      balance_type: "debit",
      is_active: true,
    },
    vouchers: [
      { id: "v1", voucher_date: "2026-01-01", voucher_no: 1, description: "Boundary receipt" },
      { id: "v2", voucher_date: "2026-01-15", voucher_no: 2, description: "Utility payment" },
      { id: "v3", voucher_date: "2026-01-31", voucher_no: 3, description: "Month-end charge" },
    ],
    entries: [
      { id: "e1", voucher_id: "v1", account_head_id: "bank-1", debit: 200, credit: 0, description: "" },
      { id: "e2", voucher_id: "v1", account_head_id: "sales-1", debit: 0, credit: 200, description: "Sales" },
      { id: "e3", voucher_id: "v2", account_head_id: "bank-1", debit: 0, credit: 50, description: "" },
      { id: "e4", voucher_id: "v2", account_head_id: "expense-1", debit: 50, credit: 0, description: "Utilities" },
      { id: "e5", voucher_id: "v3", account_head_id: "bank-1", debit: 0, credit: 25, description: "" },
      { id: "e6", voucher_id: "v3", account_head_id: "payable-1", debit: 25, credit: 0, description: "Charge" },
    ],
    fromDate: "2026-01-15",
    toDate: "2026-01-31",
  })

  assert.equal(result.rows.length, 2)
  assert.deepEqual(
    result.rows.map((row) => [row.voucherNo, row.accountHead]),
    [
      [2, "Dutch Bangla Bank"],
      [3, "Dutch Bangla Bank"],
    ]
  )
  assert.equal(result.totalDebit, 0)
  assert.equal(result.totalCredit, 75)
})

test("opening balance is included exactly once and running balance is correct", () => {
  const result = buildBankStatementResult({
    paymentModeName: "Cash",
    accountHead: {
      id: "cash-1",
      client_id: "client-1",
      name: "Cash",
      opening_balance: 500,
      balance_type: "debit",
      is_active: true,
    },
    vouchers: [
      { id: "v1", voucher_date: "2026-01-01", voucher_no: 1, description: "Opening period receipt" },
      { id: "v2", voucher_date: "2026-01-15", voucher_no: 2, description: "Cash expense" },
      { id: "v3", voucher_date: "2026-01-31", voucher_no: 3, description: "Cash sale" },
    ],
    entries: [
      { id: "e1", voucher_id: "v1", account_head_id: "cash-1", debit: 100, credit: 0, description: "" },
      { id: "e2", voucher_id: "v2", account_head_id: "cash-1", debit: 0, credit: 40, description: "" },
      { id: "e3", voucher_id: "v3", account_head_id: "cash-1", debit: 60, credit: 0, description: "" },
    ],
    fromDate: "2026-01-15",
    toDate: "2026-01-31",
  })

  assert.equal(result.openingBalance, 600)
  assert.deepEqual(
    result.rows.map((row) => row.runningBalance),
    [560, 620]
  )
  assert.equal(result.closingBalance, 620)
})

test("date boundaries are inclusive", () => {
  const result = buildBankStatementResult({
    paymentModeName: "Cash",
    accountHead: {
      id: "cash-1",
      client_id: "client-1",
      name: "Cash",
      opening_balance: 0,
      balance_type: "debit",
      is_active: true,
    },
    vouchers: [
      { id: "v1", voucher_date: "2026-01-01", voucher_no: 1, description: "Start boundary" },
      { id: "v2", voucher_date: "2026-01-31", voucher_no: 2, description: "End boundary" },
      { id: "v3", voucher_date: "2026-02-01", voucher_no: 3, description: "Out of range" },
    ],
    entries: [
      { id: "e1", voucher_id: "v1", account_head_id: "cash-1", debit: 10, credit: 0, description: "" },
      { id: "e2", voucher_id: "v2", account_head_id: "cash-1", debit: 0, credit: 5, description: "" },
      { id: "e3", voucher_id: "v3", account_head_id: "cash-1", debit: 99, credit: 0, description: "" },
    ],
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
  })

  assert.deepEqual(
    result.rows.map((row) => row.voucherNo),
    [1, 2]
  )
})

after(async () => {
  await Promise.all([balanceSheet.cleanup(), bankStatement.cleanup()])
})
