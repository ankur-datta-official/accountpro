import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadVoucherActionsModule() {
  const sourcePath = path.resolve("lib/actions/vouchers.ts")
  let source = await readFile(sourcePath, "utf8")

  source = source.replace(/^"use server"\r?\n\r?\n/, "")
  source = source.replace(/import\s+\{\s*revalidatePath\s*\}\s+from\s+"next\/cache"\r?\n/, 'const revalidatePath = () => {}\n')
  source = source.replace(/import\s+\{\s*getMonthLabel\s*\}\s+from\s+"@\/lib\/accounting\/fiscal-year"\r?\n/, 'const getMonthLabel = (value) => new Date(value).toISOString().slice(0, 7)\n')
  source = source.replace(
    /import\s+\{\s*resolveOrCreatePaymentMode,\s*resolvePaymentModeAccountHead\s*\}\s+from\s+"@\/lib\/accounting\/payment-modes"\r?\n/s,
    'const resolveOrCreatePaymentMode = async () => ({ success: false, error: "not used in reversal tests" })\nconst resolvePaymentModeAccountHead = async () => ({ success: false, error: "not used in reversal tests" })\n'
  )
  source = source.replace(
    /import\s+\{\s*runAtomicVoucherOperation,\s*validateVoucherAccountHeads,\s*validateVoucherDateInFiscalYear,\s*validateVoucherLines,\s*validateVoucherMutationPolicy,\s*\}\s+from\s+"@\/lib\/accounting\/voucher-integrity"\r?\n/s,
    `const runAtomicVoucherOperation = async ({ perform, rollback, rollbackFailureMessage }) => {
  try {
    await perform()
    return { ok: true }
  } catch (error) {
    const rolledBack = await rollback()
    return {
      ok: false,
      error: rolledBack ? (error instanceof Error ? error.message : String(error)) : rollbackFailureMessage,
    }
  }
}
const validateVoucherAccountHeads = () => ({ ok: true })
const validateVoucherLines = () => ({ ok: true, requiresAutoBalance: false })
const validateVoucherMutationPolicy = () => ({ ok: true })
const validateVoucherDateInFiscalYear = ({ expectedClientId, fiscalYearClientId, voucherDate, fiscalYearStart, fiscalYearEnd }) => {
  if (fiscalYearClientId && fiscalYearClientId !== expectedClientId) {
    return { ok: false, error: "Fiscal year not found." }
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(voucherDate)) {
    return { ok: false, error: "Voucher date must be a valid YYYY-MM-DD value." }
  }
  if (voucherDate < fiscalYearStart) {
    return { ok: false, error: "Voucher date cannot be before the selected fiscal year start date." }
  }
  if (voucherDate > fiscalYearEnd) {
    return { ok: false, error: "Voucher date cannot be after the selected fiscal year end date." }
  }
  return { ok: true, voucherDate }
}
`
  )
  source = source.replace(
    /import\s+\{\s*getVoucherLineAmountRuleError,\s*normalizeVoucherLineAmounts,\s*\}\s+from\s+"@\/lib\/accounting\/voucher-entry-rules"\r?\n/s,
    'const getVoucherLineAmountRuleError = () => null\nconst normalizeVoucherLineAmounts = (value) => value\n'
  )
  source = source.replace(/import\s+\{\s*AUTO_BALANCE_ENTRY_PREFIX\s*\}\s+from\s+"@\/lib\/accounting\/vouchers"\r?\n/, 'const AUTO_BALANCE_ENTRY_PREFIX = "Auto-balance: "\n')
  source = source.replace(
    /import\s+\{\s*extractClientIdFromRouteSegment,\s*isUuid,\s*matchesClientRouteSegment\s*\}\s+from\s+"@\/lib\/routing\/clients"\r?\n/,
    'const extractClientIdFromRouteSegment = (value) => value\nconst isUuid = () => true\nconst matchesClientRouteSegment = () => false\n'
  )
  source = source.replace(
    /import\s+\{\s*createClient,\s*getCurrentOrganizationContext\s*\}\s+from\s+"@\/lib\/supabase\/server"\r?\n/,
    'const createClient = async () => ({})\nconst getCurrentOrganizationContext = async () => ({ membership: null })\n'
  )
  source += "\nexport { prepareVoucherReversal, applyVoucherReversalMutation }\n"

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempRoot = path.resolve(".tmp-test-artifacts")
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, "voucher-reversal-"))
  const modulePath = path.join(tempDir, "vouchers.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const vouchers = await loadVoucherActionsModule()
const { applyVoucherReversalMutation, prepareVoucherReversal } = vouchers

function voucher(overrides = {}) {
  return {
    id: "voucher-1",
    client_id: "client-1",
    fiscal_year_id: "fy-2026",
    voucher_no: 42,
    voucher_date: "2026-06-15",
    voucher_type: "journal",
    payment_mode_id: null,
    show_description: true,
    description: "Sales accrual",
    show_supporting_documents: true,
    month_label: "2026-06",
    is_posted: true,
    is_reversal: false,
    reversal_reason: null,
    reversed_at: null,
    reversed_by: null,
    reversed_voucher_id: null,
    reversal_voucher_id: null,
    ...overrides,
  }
}

function fiscalYear(overrides = {}) {
  return {
    id: "fy-2026",
    client_id: "client-1",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    is_active: true,
    is_closed: false,
    ...overrides,
  }
}

function entries() {
  return [
    {
      account_head_id: "cash",
      accounts_group: "asset",
      debit: 125,
      credit: 0,
      description: "Cash receipt",
    },
    {
      account_head_id: "sales",
      accounts_group: "income",
      debit: 0,
      credit: 125,
      description: "Sales income",
    },
  ]
}

function prepare(overrides = {}) {
  return prepareVoucherReversal({
    voucher: voucher(),
    entries: entries(),
    targetClientId: "client-1",
    targetFiscalYear: fiscalYear(),
    reversalDate: "2026-07-01",
    reversalReason: "Customer return",
    reversedBy: "user-1",
    nextVoucherNo: 43,
    now: "2026-07-19T10:30:00.000Z",
    ...overrides,
  })
}

test("reversal success", () => {
  const result = prepare()

  assert.equal(result.ok, true)
  assert.equal(result.reversalVoucherInsert.is_reversal, true)
  assert.equal(result.reversalVoucherInsert.voucher_no, 43)
  assert.equal(result.reversalVoucherInsert.reversed_voucher_id, "voucher-1")
})

test("swapped entries", () => {
  const result = prepare()

  assert.equal(result.ok, true)
  assert.deepEqual(result.reversalEntries, [
    {
      account_head_id: "cash",
      accounts_group: "asset",
      debit: 0,
      credit: 125,
      description: "Cash receipt",
    },
    {
      account_head_id: "sales",
      accounts_group: "income",
      debit: 125,
      credit: 0,
      description: "Sales income",
    },
  ])
})

test("original remains unchanged", () => {
  const originalVoucher = voucher()
  const originalEntries = entries()
  const originalSnapshot = JSON.parse(JSON.stringify({ originalVoucher, originalEntries }))

  prepare({
    voucher: originalVoucher,
    entries: originalEntries,
  })

  assert.deepEqual({ originalVoucher, originalEntries }, originalSnapshot)
})

test("links stored", () => {
  const result = prepare()

  assert.equal(result.ok, true)
  assert.equal(result.reversalVoucherInsert.reversed_voucher_id, "voucher-1")
  assert.deepEqual(result.buildOriginalVoucherUpdate("voucher-2"), {
    reversal_voucher_id: "voucher-2",
    reversal_reason: "Customer return",
    reversed_at: "2026-07-19T10:30:00.000Z",
    reversed_by: "user-1",
    updated_at: "2026-07-19T10:30:00.000Z",
  })
})

test("duplicate rejection", () => {
  const result = prepare({
    voucher: voucher({ reversal_voucher_id: "voucher-2" }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /already been reversed/i)
})

test("draft rejection", () => {
  const result = prepare({
    voucher: voucher({ is_posted: false }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /only posted vouchers/i)
})

test("re-reversal rejection", () => {
  const result = prepare({
    voucher: voucher({ is_reversal: true, reversed_voucher_id: "voucher-0" }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /cannot be reversed again/i)
})

test("cross-client rejection", () => {
  const result = prepare({
    targetClientId: "client-2",
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "Voucher not found.")
})

test("closed-year rejection", () => {
  const result = prepare({
    targetFiscalYear: fiscalYear({ is_closed: true }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /open fiscal year/i)
})

test("rollback safety", async () => {
  const calls = []
  const result = await applyVoucherReversalMutation({
    createReversalVoucher: async () => {
      calls.push("create")
      return { id: "voucher-2" }
    },
    insertReversalEntries: async () => {
      calls.push("entries")
      throw new Error("entry insert failed")
    },
    updateOriginalVoucher: async () => {
      calls.push("update-original")
    },
    rollbackReversalVoucher: async (reversalVoucherId) => {
      calls.push(`rollback:${reversalVoucherId}`)
      return true
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, "entry insert failed")
  assert.deepEqual(calls, ["create", "entries", "rollback:voucher-2"])
})

test("reports remain balanced", () => {
  const result = prepare()

  assert.equal(result.ok, true)

  const netByAccount = new Map()
  for (const entry of [...entries(), ...result.reversalEntries]) {
    const current = netByAccount.get(entry.account_head_id) ?? 0
    netByAccount.set(entry.account_head_id, current + Number(entry.debit || 0) - Number(entry.credit || 0))
  }

  assert.deepEqual(Array.from(netByAccount.values()), [0, 0])
})

after(async () => {
  await vouchers.cleanup()
})
