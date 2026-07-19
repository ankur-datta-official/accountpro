import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadPaymentModesModule() {
  const sourcePath = path.resolve("lib/accounting/payment-modes.ts")
  let source = await readFile(sourcePath, "utf8")

  source = source.replace(/import\s+\{\s*createClient\s*\}\s+from\s+"@supabase\/supabase-js"\r?\n/, "const createClient = () => ({})\n")
  source = source.replace(
    /import\s+\{\s*createPaymentModeAccountHeadForClient\s*\}\s+from\s+"@\/lib\/accounting\/defaults"\r?\n/,
    "const createPaymentModeAccountHeadForClient = async () => {}\n"
  )

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempRoot = path.resolve(".tmp-test-artifacts")
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, "payment-mode-mapping-"))
  const modulePath = path.join(tempDir, "payment-modes.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const paymentModes = await loadPaymentModesModule()
const {
  buildPaymentModeAccountBackfill,
  resolveMappedPaymentModeAccount,
  validatePaymentModeAccountMapping,
} = paymentModes

function paymentMode(overrides = {}) {
  return {
    id: "mode-1",
    client_id: "client-1",
    name: "Main Bank",
    type: "bank",
    is_active: true,
    account_head_id: "head-1",
    ...overrides,
  }
}

function accountHead(overrides = {}) {
  return {
    id: "head-1",
    client_id: "client-1",
    name: "Main Bank",
    is_active: true,
    type: "asset",
    ...overrides,
  }
}

test("FK mapping success", () => {
  const result = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: paymentMode(),
    accountHeads: [accountHead()],
  })

  assert.equal(result.ok, true)
  assert.equal(result.accountHead.id, "head-1")
})

test("auto-backfill success", () => {
  const result = buildPaymentModeAccountBackfill({
    paymentModes: [paymentMode({ account_head_id: null, name: "Cash In Hand" })],
    accountHeads: [accountHead({ id: "cash-1", name: "Cash In Hand" })],
  })

  assert.deepEqual(result.updates, [{ paymentModeId: "mode-1", accountHeadId: "cash-1" }])
  assert.deepEqual(result.unmapped, [])
})

test("unmapped rows report", () => {
  const result = buildPaymentModeAccountBackfill({
    paymentModes: [paymentMode({ account_head_id: null, name: "Missing Mode" })],
    accountHeads: [accountHead({ id: "cash-1", name: "Cash In Hand" })],
  })

  assert.deepEqual(result.updates, [])
  assert.deepEqual(result.unmapped, [
    {
      paymentModeId: "mode-1",
      paymentModeName: "Missing Mode",
      reason: "no_active_asset_match",
    },
  ])
})

test("cross-client rejection", () => {
  const result = validatePaymentModeAccountMapping({
    clientId: "client-1",
    accountHead: accountHead({ client_id: "client-2" }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /same-client/i)
})

test("inactive account rejection", () => {
  const result = validatePaymentModeAccountMapping({
    clientId: "client-1",
    accountHead: accountHead({ is_active: false }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /active/i)
})

test("invalid category rejection", () => {
  const result = validatePaymentModeAccountMapping({
    clientId: "client-1",
    accountHead: accountHead({ type: "liability" }),
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /asset account/i)
})

test("renamed account still works", () => {
  const result = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: paymentMode({ name: "Payroll Bank", account_head_id: "bank-2" }),
    accountHeads: [accountHead({ id: "bank-2", name: "Operating Account - Renamed" })],
  })

  assert.equal(result.ok, true)
  assert.equal(result.accountHead.name, "Operating Account - Renamed")
})

test("duplicate names no longer matter", () => {
  const result = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: paymentMode({ account_head_id: "bank-2" }),
    accountHeads: [
      accountHead({ id: "bank-1", name: "Main Bank" }),
      accountHead({ id: "bank-2", name: "Main Bank" }),
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(result.accountHead.id, "bank-2")
})

test("bank statement uses FK only", () => {
  const result = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: paymentMode({ name: "Dutch Bangla Bank", account_head_id: "bank-9" }),
    accountHeads: [accountHead({ id: "bank-9", name: "Treasury Clearing Account" })],
  })

  assert.equal(result.ok, true)
  assert.equal(result.accountHead.id, "bank-9")
})

test("payroll payment uses FK only", () => {
  const result = resolveMappedPaymentModeAccount({
    clientId: "client-1",
    paymentMode: paymentMode({ name: "Salary Disbursement Bank", account_head_id: "bank-4" }),
    accountHeads: [accountHead({ id: "bank-4", name: "Payroll Settlement Account" })],
  })

  assert.equal(result.ok, true)
  assert.equal(result.accountHead.id, "bank-4")
})

after(async () => {
  await paymentModes.cleanup()
})
