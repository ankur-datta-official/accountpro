import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadVoucherIntegrityModule() {
  const sourcePath = path.resolve("lib/accounting/voucher-integrity.ts")
  const source = await readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voucher-integrity-"))
  const modulePath = path.join(tempDir, "voucher-integrity.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const integrity = await loadVoucherIntegrityModule()
const {
  runAtomicVoucherOperation,
  validateVoucherAccountHeads,
  validateVoucherDateInFiscalYear,
  validateVoucherLines,
  validateVoucherMutationPolicy,
} = integrity

function line(overrides = {}) {
  return {
    accountHeadId: "head-1",
    accountsGroup: "expense",
    debitAmount: 100,
    creditAmount: 0,
    ...overrides,
  }
}

function accountHead(overrides = {}) {
  return {
    id: "head-1",
    client_id: "client-1",
    sub_group_id: "sub-1",
    is_active: true,
    type: "asset",
    ...overrides,
  }
}

test("accepts a balanced journal voucher", () => {
  const result = validateVoucherLines(
    [
      line({ debitAmount: 100, creditAmount: 0 }),
      line({
        accountHeadId: "head-2",
        accountsGroup: "liability",
        debitAmount: 0,
        creditAmount: 100,
      }),
    ],
    "journal"
  )

  assert.equal(result.ok, true)
  assert.equal(result.requiresAutoBalance, false)
})

test("rejects an unbalanced journal voucher", () => {
  const result = validateVoucherLines(
    [
      line({ debitAmount: 100 }),
      line({
        accountHeadId: "head-2",
        accountsGroup: "liability",
        debitAmount: 0,
        creditAmount: 90,
      }),
    ],
    "journal"
  )

  assert.equal(result.ok, false)
  assert.match(result.error, /balanced/i)
})

test("rejects zero-only voucher lines", () => {
  const result = validateVoucherLines(
    [
      line({ debitAmount: 0, creditAmount: 0 }),
      line({
        accountHeadId: "head-2",
        accountsGroup: "liability",
        debitAmount: 0,
        creditAmount: 0,
      }),
    ],
    "journal"
  )

  assert.equal(result.ok, false)
  assert.match(result.error, /non-zero/i)
})

test("rejects malformed amounts including infinity", () => {
  const result = validateVoucherLines(
    [
      line({ debitAmount: Number.POSITIVE_INFINITY }),
      line({
        accountHeadId: "head-2",
        accountsGroup: "liability",
        debitAmount: 0,
        creditAmount: 100,
      }),
    ],
    "journal"
  )

  assert.equal(result.ok, false)
  assert.match(result.error, /finite positive numbers/i)
})

test("accepts exact fiscal-year boundaries", () => {
  const startResult = validateVoucherDateInFiscalYear({
    expectedClientId: "client-1",
    fiscalYearClientId: "client-1",
    voucherDate: "2026-01-01",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
  })
  const endResult = validateVoucherDateInFiscalYear({
    expectedClientId: "client-1",
    fiscalYearClientId: "client-1",
    voucherDate: "2026-12-31",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
  })

  assert.equal(startResult.ok, true)
  assert.equal(endResult.ok, true)
})

test("rejects voucher date before fiscal year", () => {
  const result = validateVoucherDateInFiscalYear({
    expectedClientId: "client-1",
    fiscalYearClientId: "client-1",
    voucherDate: "2025-12-31",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /before/i)
})

test("rejects voucher date after fiscal year", () => {
  const result = validateVoucherDateInFiscalYear({
    expectedClientId: "client-1",
    fiscalYearClientId: "client-1",
    voucherDate: "2027-01-01",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /after/i)
})

test("rejects fiscal year from another client", () => {
  const result = validateVoucherDateInFiscalYear({
    expectedClientId: "client-1",
    fiscalYearClientId: "client-2",
    voucherDate: "2026-06-01",
    fiscalYearStart: "2026-01-01",
    fiscalYearEnd: "2026-12-31",
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "Fiscal year not found.")
})

test("rejects cross-client account heads", () => {
  const result = validateVoucherAccountHeads({
    clientId: "client-1",
    lines: [
      line({ accountHeadId: "head-1" }),
      line({
        accountHeadId: "head-foreign",
        accountsGroup: "liability",
        debitAmount: 0,
        creditAmount: 100,
      }),
    ],
    accountHeads: [
      accountHead(),
      accountHead({
        id: "head-foreign",
        client_id: "client-2",
      }),
    ],
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /invalid or unavailable/i)
})

test("rejects posted voucher edits", () => {
  const result = validateVoucherMutationPolicy({
    operation: "update",
    isPosted: true,
    isFiscalYearClosed: false,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /cannot be edited directly/i)
})

test("rejects posted voucher deletes", () => {
  const result = validateVoucherMutationPolicy({
    operation: "delete",
    isPosted: true,
    isFiscalYearClosed: false,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /cannot be deleted directly/i)
})

test("rejects posted voucher bulk delete", () => {
  const result = validateVoucherMutationPolicy({
    operation: "bulk-delete",
    isPosted: true,
    isFiscalYearClosed: false,
    requestedCount: 2,
    matchedCount: 2,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /cannot be deleted directly/i)
})

test("rejects closed fiscal-year mutation", () => {
  const result = validateVoucherMutationPolicy({
    operation: "delete",
    isPosted: false,
    isFiscalYearClosed: true,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /immutable/i)
})

test("bulk delete stays all-or-nothing when selections do not match", () => {
  const result = validateVoucherMutationPolicy({
    operation: "bulk-delete",
    isPosted: false,
    isFiscalYearClosed: false,
    requestedCount: 3,
    matchedCount: 2,
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /partially delete/i)
})

test("atomic create helper rolls back on failure", async () => {
  let rolledBack = false

  const result = await runAtomicVoucherOperation({
    perform: async () => {
      throw new Error("insert failed")
    },
    rollback: async () => {
      rolledBack = true
      return true
    },
    failureMessage: "create failed",
    rollbackFailureMessage: "rollback failed",
  })

  assert.equal(result.ok, false)
  assert.equal(rolledBack, true)
  assert.equal(result.error, "insert failed")
})

test("atomic update helper reports rollback failure clearly", async () => {
  const result = await runAtomicVoucherOperation({
    perform: async () => {
      throw new Error("update failed")
    },
    rollback: async () => false,
    failureMessage: "update failed",
    rollbackFailureMessage: "rollback failed",
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "rollback failed")
})

after(async () => {
  await integrity.cleanup()
})
