import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadModule({ sourcePath, outputName, replacements = [], append = "" }) {
  let source = await readFile(sourcePath, "utf8")

  for (const [searchValue, replaceValue] of replacements) {
    source = source.replace(searchValue, replaceValue)
  }

  if (append) {
    source += append
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
  const tempDir = await mkdtemp(path.join(tempRoot, "accounting-regression-"))
  const modulePath = path.join(tempDir, outputName)
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const vouchers = await loadModule({
  sourcePath: path.resolve("lib/actions/vouchers.ts"),
  outputName: "vouchers.mjs",
  replacements: [
    [/^"use server"\r?\n\r?\n/, ""],
    [/import\s+\{\s*revalidatePath\s*\}\s+from\s+"next\/cache"\r?\n/, "const revalidatePath = () => {}\n"],
    [/import\s+\{\s*getMonthLabel\s*\}\s+from\s+"@\/lib\/accounting\/fiscal-year"\r?\n/, 'const getMonthLabel = (value) => new Date(value).toISOString().slice(0, 7)\n'],
    [
      /import\s+\{\s*resolveOrCreatePaymentMode,\s*resolvePaymentModeAccountHead\s*\}\s+from\s+"@\/lib\/accounting\/payment-modes"\r?\n/s,
      'const resolveOrCreatePaymentMode = async () => ({ success: false, error: "not used in regression tests" })\nconst resolvePaymentModeAccountHead = async () => ({ success: false, error: "not used in regression tests" })\n',
    ],
    [
      /import\s+\{\s*runAtomicVoucherOperation,\s*validateVoucherAccountHeads,\s*validateVoucherDateInFiscalYear,\s*validateVoucherLines,\s*validateVoucherMutationPolicy,\s*\}\s+from\s+"@\/lib\/accounting\/voucher-integrity"\r?\n/s,
      `const runAtomicVoucherOperation = async ({ perform, rollback, rollbackFailureMessage }) => {\n  try {\n    await perform()\n    return { ok: true }\n  } catch (error) {\n    const rolledBack = await rollback()\n    return { ok: false, error: rolledBack ? (error instanceof Error ? error.message : String(error)) : rollbackFailureMessage }\n  }\n}\nconst validateVoucherAccountHeads = () => ({ ok: true })\nconst validateVoucherLines = () => ({ ok: true, requiresAutoBalance: false })\nconst validateVoucherMutationPolicy = ({ operation, isPosted, isFiscalYearClosed }) => {\n  if (isFiscalYearClosed) return { ok: false, error: "Closed fiscal-year vouchers are immutable." }\n  if (operation === "update") return { ok: true }\n  if (isPosted) return { ok: false, error: "Posted vouchers cannot be deleted directly." }\n  return { ok: true }\n}\nconst validateVoucherDateInFiscalYear = ({ expectedClientId, fiscalYearClientId, voucherDate, fiscalYearStart, fiscalYearEnd }) => {\n  if (fiscalYearClientId && fiscalYearClientId !== expectedClientId) return { ok: false, error: "Fiscal year not found." }\n  if (voucherDate < fiscalYearStart) return { ok: false, error: "Voucher date cannot be before the selected fiscal year start date." }\n  if (voucherDate > fiscalYearEnd) return { ok: false, error: "Voucher date cannot be after the selected fiscal year end date." }\n  return { ok: true, voucherDate }\n}\n`,
    ],
    [
      /import\s+\{\s*getVoucherLineAmountRuleError,\s*normalizeVoucherLineAmounts,\s*\}\s+from\s+"@\/lib\/accounting\/voucher-entry-rules"\r?\n/s,
      "const getVoucherLineAmountRuleError = () => null\nconst normalizeVoucherLineAmounts = (value) => value\n",
    ],
    [/import\s+\{\s*AUTO_BALANCE_ENTRY_PREFIX\s*\}\s+from\s+"@\/lib\/accounting\/vouchers"\r?\n/, 'const AUTO_BALANCE_ENTRY_PREFIX = "Auto-balance: "\n'],
    [
      /import\s+\{\s*extractClientIdFromRouteSegment,\s*isUuid,\s*matchesClientRouteSegment\s*\}\s+from\s+"@\/lib\/routing\/clients"\r?\n/,
      "const extractClientIdFromRouteSegment = (value) => value\nconst isUuid = () => true\nconst matchesClientRouteSegment = () => false\n",
    ],
    [
      /import\s+\{\s*createClient,\s*getCurrentOrganizationContext\s*\}\s+from\s+"@\/lib\/supabase\/server"\r?\n/,
      "const createClient = async () => ({})\nconst getCurrentOrganizationContext = async () => ({ membership: null })\n",
    ],
  ],
  append: "\nexport { prepareVoucherReversal, applyVoucherReversalMutation }\n",
})

const payroll = await loadModule({
  sourcePath: path.resolve("lib/accounting/payroll-integrity.ts"),
  outputName: "payroll-integrity.mjs",
})

const paymentModes = await loadModule({
  sourcePath: path.resolve("lib/accounting/payment-modes.ts"),
  outputName: "payment-modes.mjs",
  replacements: [
    ['import { createClient } from "@supabase/supabase-js"\n', "const createClient = () => ({})\n"],
    ['import { createPaymentModeAccountHeadForClient } from "@/lib/accounting/defaults"\n', "const createPaymentModeAccountHeadForClient = async () => {}\n"],
  ],
})

const reports = await loadModule({
  sourcePath: path.resolve("lib/accounting/balance-sheet.ts"),
  outputName: "balance-sheet.mjs",
  replacements: [[
    'import { calculateTrialBalance, type TrialBalanceRow } from "@/lib/accounting/trial-balance"',
    "const calculateTrialBalance = async () => ({ accounts: [] })",
  ]],
})

const bankStatement = await loadModule({
  sourcePath: path.resolve("lib/accounting/bank-statement.ts"),
  outputName: "bank-statement.mjs",
  replacements: [[
    'import { resolveMappedPaymentModeAccount, type PaymentModeAccountHead } from "@/lib/accounting/payment-modes"',
    "const resolveMappedPaymentModeAccount = ({ clientId, paymentMode, accountHeads }) => { const accountHead = accountHeads.find((head) => head.id === paymentMode.account_head_id) ?? null; if (!paymentMode.account_head_id || !accountHead || accountHead.client_id !== clientId || accountHead.is_active === false || accountHead.type !== 'asset') { return { ok: false, error: 'The selected payment mode must be linked to an active same-client cash or bank asset account.' } } return { ok: true, accountHead } }",
  ]],
})

const {
  prepareVoucherReversal,
  applyVoucherReversalMutation,
} = vouchers
const {
  buildPayrollAccrualVoucherLines,
  buildPayrollPaymentVoucherLines,
  runPayrollCompensatingAction,
  validatePayrollLifecycle,
} = payroll
const {
  resolveMappedPaymentModeAccount,
  validatePaymentModeAccountMapping,
} = paymentModes
const { buildStatementFromRows } = reports
const { buildBankStatementResult } = bankStatement

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

test("scenario 1: create-post-reverse flow keeps reports balanced", () => {
  const reversal = prepareVoucherReversal({
    voucher: {
      id: "voucher-1",
      client_id: "client-1",
      fiscal_year_id: "fy-1",
      voucher_no: 9,
      voucher_date: "2026-07-10",
      voucher_type: "journal",
      payment_mode_id: null,
      show_description: true,
      description: "Revenue recognition",
      show_supporting_documents: false,
      month_label: "2026-07",
      is_posted: true,
      is_reversal: false,
      reversal_reason: null,
      reversed_at: null,
      reversed_by: null,
      reversed_voucher_id: null,
      reversal_voucher_id: null,
    },
    entries: [
      { account_head_id: "cash", accounts_group: "asset", debit: 300, credit: 0, description: "Cash" },
      { account_head_id: "income", accounts_group: "income", debit: 0, credit: 300, description: "Income" },
    ],
    targetClientId: "client-1",
    targetFiscalYear: { id: "fy-1", client_id: "client-1", start_date: "2026-01-01", end_date: "2026-12-31", is_active: true, is_closed: false },
    reversalDate: "2026-07-11",
    reversalReason: "Cancelled sale",
    reversedBy: "user-1",
    nextVoucherNo: 10,
    now: "2026-07-19T10:00:00.000Z",
  })

  assert.equal(reversal.ok, true)

  const statement = buildStatementFromRows(
    [
      trialRow({ accountHeadId: "cash", accountHeadName: "Cash", groupType: "asset", debit: 1000, balanceLabel: "1000.00 Dr" }),
      trialRow({ accountHeadId: "capital", accountHeadName: "Capital", groupType: "liability", balanceType: "credit", credit: 1000, balanceLabel: "1000.00 Cr" }),
    ],
    { id: "fy-1", label: "FY 2026", end_date: "2026-12-31" },
    0
  )

  assert.equal(statement.assets.totalAssets, statement.liabilitiesEquity.totalLiabilitiesEquity)
  const net = [...reversal.reversalEntries, { account_head_id: "cash", debit: 300, credit: 0 }, { account_head_id: "income", debit: 0, credit: 300 }]
    .reduce((sum, entry) => sum + Number(entry.debit || 0) - Number(entry.credit || 0), 0)
  assert.equal(net, 0)
})

test("scenario 2: payroll accrual then payment clears liability", () => {
  const accrual = buildPayrollAccrualVoucherLines({
    components: [{ mappingCode: "salary_expense", kind: "earning", amount: 500 }],
    netPayable: 500,
    mappingsByCode: {
      salary_expense: { accountHeadId: "exp-1", accountsGroup: "expense" },
      salary_payable: { accountHeadId: "liab-1", accountsGroup: "liability" },
    },
    periodLabel: "Jul-2026",
  })
  const payment = buildPayrollPaymentVoucherLines({
    salaryPayableHeadId: "liab-1",
    paymentAccountHeadId: "bank-1",
    amount: 500,
    periodLabel: "Jul-2026",
  })

  assert.equal(accrual.ok, true)
  assert.equal(payment.ok, true)

  const accrualSalaryPayable = accrual.lines.find((line) => line.accountHeadId === "liab-1")
  const paymentSalaryPayable = payment.lines.find((line) => line.accountHeadId === "liab-1")

  assert.ok(accrualSalaryPayable)
  assert.ok(paymentSalaryPayable)

  const salaryPayableNet =
    accrualSalaryPayable.creditAmount -
    paymentSalaryPayable.debitAmount
  assert.equal(salaryPayableNet, 0)
})

test("scenario 3: renamed bank account still works through FK mapping", () => {
  const mapped = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: { id: "mode-1", client_id: "client-1", name: "Old Bank Name", type: "bank", is_active: true, account_head_id: "head-9" },
    accountHeads: [{ id: "head-9", client_id: "client-1", name: "Renamed Treasury Account", is_active: true, type: "asset" }],
  })

  assert.equal(mapped.ok, true)

  const statement = buildBankStatementResult({
    paymentModeName: "Old Bank Name",
    accountHead: { id: "head-9", client_id: "client-1", name: "Renamed Treasury Account", opening_balance: 200, balance_type: "debit", is_active: true },
    vouchers: [{ id: "v1", voucher_date: "2026-07-01", voucher_no: 1, description: "Deposit" }],
    entries: [{ id: "e1", voucher_id: "v1", account_head_id: "head-9", debit: 50, credit: 0, description: "" }],
    fromDate: "2026-07-01",
    toDate: "2026-07-31",
  })

  assert.equal(statement.closingBalance, 250)
})

test("scenario 4: closed fiscal year mutation rejection holds across modules", () => {
  const payrollBlocked = validatePayrollLifecycle({
    operation: "post-accrual",
    status: "draft",
    isFiscalYearClosed: true,
    accrualVoucherId: null,
    paymentVoucherId: null,
  })
  const voucherBlocked = prepareVoucherReversal({
    voucher: {
      id: "voucher-1",
      client_id: "client-1",
      fiscal_year_id: "fy-1",
      voucher_no: 1,
      voucher_date: "2026-06-30",
      voucher_type: "journal",
      payment_mode_id: null,
      show_description: true,
      description: "Closing entry",
      show_supporting_documents: false,
      month_label: "2026-06",
      is_posted: true,
      is_reversal: false,
      reversal_reason: null,
      reversed_at: null,
      reversed_by: null,
      reversed_voucher_id: null,
      reversal_voucher_id: null,
    },
    entries: [{ account_head_id: "cash", accounts_group: "asset", debit: 10, credit: 0, description: "" }],
    targetClientId: "client-1",
    targetFiscalYear: { id: "fy-1", client_id: "client-1", start_date: "2026-01-01", end_date: "2026-12-31", is_active: true, is_closed: true },
    reversalDate: "2026-07-01",
    reversalReason: "Late change",
    reversedBy: "user-1",
    nextVoucherNo: 2,
  })

  assert.equal(payrollBlocked.ok, false)
  assert.equal(voucherBlocked.ok, false)
})

test("scenario 5: cross-tenant attack attempts stay rejected", () => {
  const mapped = validatePaymentModeAccountMapping({
    clientId: "client-1",
    accountHead: { id: "head-1", client_id: "client-2", name: "Foreign Bank", is_active: true, type: "asset" },
  })

  assert.equal(mapped.ok, false)
  assert.match(mapped.error, /same-client/i)
})

test("scenario 6: partial failure rollback helpers fire compensating cleanup", async () => {
  let voucherRollback = 0
  let payrollRollback = 0

  const reversalResult = await applyVoucherReversalMutation({
    createReversalVoucher: async () => ({ id: "rev-1" }),
    insertReversalEntries: async () => {
      throw new Error("entry failure")
    },
    updateOriginalVoucher: async () => {},
    rollbackReversalVoucher: async () => {
      voucherRollback += 1
      return true
    },
  })

  const payrollResult = await runPayrollCompensatingAction({
    perform: async () => {
      throw new Error("payment failure")
    },
    rollback: async () => {
      payrollRollback += 1
      return true
    },
    rollbackFailureMessage: "rollback failed",
  })

  assert.equal(reversalResult.ok, false)
  assert.equal(payrollResult.ok, false)
  assert.equal(voucherRollback, 1)
  assert.equal(payrollRollback, 1)
})

test("scenario 7: profit and loss year transition remains separated from opening retained earnings", () => {
  const statement = buildStatementFromRows(
    [
      trialRow({ accountHeadId: "cash", accountHeadName: "Cash", groupType: "asset", debit: 180, balanceLabel: "180.00 Dr" }),
      trialRow({ accountHeadId: "capital", accountHeadName: "Capital", groupType: "liability", balanceType: "credit", credit: 100, balanceLabel: "100.00 Cr" }),
      trialRow({ accountHeadId: "income", accountHeadName: "Service Income", groupType: "income", balanceType: "credit", credit: 120, balanceLabel: "120.00 Cr" }),
      trialRow({ accountHeadId: "expense", accountHeadName: "Expense", groupType: "expense", debit: 60, balanceLabel: "60.00 Dr" }),
    ],
    { id: "fy-2", label: "FY 2027", end_date: "2027-12-31" },
    20
  )

  assert.equal(statement.openingRetainedEarnings, 20)
  assert.equal(statement.netProfitLoss, 60)
  assert.equal(statement.retainedEarnings, 80)
})

after(async () => {
  await Promise.all([
    vouchers.cleanup(),
    payroll.cleanup(),
    paymentModes.cleanup(),
    reports.cleanup(),
    bankStatement.cleanup(),
  ])
})
