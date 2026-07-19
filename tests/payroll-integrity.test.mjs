import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadPayrollIntegrityModule() {
  const sourcePath = path.resolve("lib/accounting/payroll-integrity.ts")
  const source = await readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "payroll-integrity-"))
  const modulePath = path.join(tempDir, "payroll-integrity.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const integrity = await loadPayrollIntegrityModule()
const {
  buildPayrollAccrualVoucherLines,
  buildPayrollPaymentVoucherLines,
  runPayrollCompensatingAction,
  validateDuplicatePayrollRun,
  validatePaymentAccountHead,
  validatePayrollLifecycle,
  validatePayrollPeriodWithinFiscalYear,
  validateResolvedPayrollEmployees,
} = integrity

function mapping(accountHeadId, accountsGroup) {
  return { accountHeadId, accountsGroup }
}

test("partial payroll creation rollback uses compensating cleanup", async () => {
  let rolledBack = false

  const result = await runPayrollCompensatingAction({
    perform: async () => {
      throw new Error("row insert failed")
    },
    rollback: async () => {
      rolledBack = true
      return true
    },
    rollbackFailureMessage: "rollback failed",
  })

  assert.equal(result.ok, false)
  assert.equal(rolledBack, true)
  assert.equal(result.error, "row insert failed")
})

test("duplicate run prevention rejects an existing period", () => {
  const result = validateDuplicatePayrollRun(true)

  assert.equal(result.ok, false)
  assert.match(result.error, /already exists/i)
})

test("duplicate accrual prevention rejects reposting", () => {
  const result = validatePayrollLifecycle({
    operation: "post-accrual",
    status: "posted",
    isFiscalYearClosed: false,
    accrualVoucherId: "voucher-1",
    paymentVoucherId: null,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /already been posted/i)
})

test("duplicate payment prevention rejects reposting", () => {
  const result = validatePayrollLifecycle({
    operation: "post-payment",
    status: "paid",
    isFiscalYearClosed: false,
    accrualVoucherId: "voucher-1",
    paymentVoucherId: "voucher-2",
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /already been posted/i)
})

test("payment before post is rejected", () => {
  const result = validatePayrollLifecycle({
    operation: "post-payment",
    status: "draft",
    isFiscalYearClosed: false,
    accrualVoucherId: null,
    paymentVoucherId: null,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /before salary payment|before salary payment|before salary/i)
})

test("posted run edit is rejected", () => {
  const result = validatePayrollLifecycle({
    operation: "edit",
    status: "posted",
    isFiscalYearClosed: false,
    accrualVoucherId: "voucher-1",
    paymentVoucherId: null,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /locked/i)
})

test("paid run mutation is rejected", () => {
  const result = validatePayrollLifecycle({
    operation: "rerun",
    status: "paid",
    isFiscalYearClosed: false,
    accrualVoucherId: "voucher-1",
    paymentVoucherId: "voucher-2",
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /paid payroll runs are locked/i)
})

test("balanced accrual voucher is built exactly", () => {
  const result = buildPayrollAccrualVoucherLines({
    components: [
      { mappingCode: "salary_expense", kind: "earning", amount: 1000 },
      { mappingCode: "employer_pf_expense", kind: "employer_contribution", amount: 100 },
      { mappingCode: "pf_payable", kind: "deduction", amount: 80 },
      { mappingCode: "tax_payable", kind: "deduction", amount: 20 },
    ],
    netPayable: 1000,
    mappingsByCode: {
      salary_expense: mapping("exp-1", "expense"),
      employer_pf_expense: mapping("exp-2", "expense"),
      pf_payable: mapping("liab-1", "liability"),
      tax_payable: mapping("liab-2", "liability"),
      salary_payable: mapping("liab-3", "liability"),
    },
    periodLabel: "Jul-2026",
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalDebit, 1100)
  assert.equal(result.totalCredit, 1100)
})

test("balanced payment voucher is built exactly", () => {
  const result = buildPayrollPaymentVoucherLines({
    salaryPayableHeadId: "liab-1",
    paymentAccountHeadId: "bank-1",
    amount: 950,
    periodLabel: "Jul-2026",
  })

  assert.equal(result.ok, true)
  assert.equal(result.totalDebit, 950)
  assert.equal(result.totalCredit, 950)
  assert.equal(result.lines[1].accountHeadId, "bank-1")
})

test("failed voucher creation leaves payroll unchanged via rollback path", async () => {
  let rollbackCalls = 0

  const result = await runPayrollCompensatingAction({
    perform: async () => {
      throw new Error("voucher create failed")
    },
    rollback: async () => {
      rollbackCalls += 1
      return true
    },
    rollbackFailureMessage: "rollback failed",
  })

  assert.equal(result.ok, false)
  assert.equal(rollbackCalls, 1)
  assert.equal(result.error, "voucher create failed")
})

test("failed status update leaves no orphan voucher", async () => {
  const result = await runPayrollCompensatingAction({
    perform: async () => {
      throw new Error("status update failed")
    },
    rollback: async () => true,
    rollbackFailureMessage: "voucher cleanup failed",
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "status update failed")
})

test("cross-client bank or cash mapping is rejected", () => {
  const result = validatePaymentAccountHead({
    clientId: "client-1",
    accountHead: {
      id: "bank-1",
      clientId: "client-2",
      isActive: true,
      type: "asset",
    },
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /same-client cash or bank account/i)
})

test("closed fiscal-year mutation is rejected", () => {
  const result = validatePayrollLifecycle({
    operation: "post-accrual",
    status: "draft",
    isFiscalYearClosed: true,
    accrualVoucherId: null,
    paymentVoucherId: null,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /immutable/i)
})

test("inactive or foreign employees are rejected", () => {
  const result = validateResolvedPayrollEmployees({
    expectedClientId: "client-1",
    employees: [
      { id: "emp-1", clientId: "client-1", isActive: true },
      { id: "emp-2", clientId: "client-2", isActive: true },
    ],
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /active employees from the same client/i)
})

test("payroll period must remain inside fiscal year boundaries", () => {
  const result = validatePayrollPeriodWithinFiscalYear({
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    fiscalYearStart: "2026-08-01",
    fiscalYearEnd: "2027-07-31",
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /within the selected fiscal year/i)
})

after(async () => {
  await integrity.cleanup()
})
