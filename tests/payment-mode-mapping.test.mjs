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
  resolveOrCreatePaymentMode,
  resolvePaymentModeAccountHead,
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
    sub_group_id: "sub-cash-bank",
    ...overrides,
  }
}

function createSupabaseStub({
  paymentModes = [],
  accountHeads = [],
  accountGroups = [{ id: "group-current-assets", client_id: "client-1", name: "Current Assets", type: "asset" }],
  accountSemiSubGroups = [
    { id: "semi-cash-bank", client_id: "client-1", group_id: "group-current-assets", name: "Cash & Bank Balance" },
  ],
  accountSubGroups = [
    { id: "sub-cash-bank", client_id: "client-1", semi_sub_id: "semi-cash-bank", name: "Cash & Bank Balance" },
  ],
} = {}) {
  const paymentModeRows = paymentModes.map((row) => ({ ...row }))
  const accountHeadRows = accountHeads.map((row) => ({ ...row }))
  const accountGroupRows = accountGroups.map((row) => ({ ...row }))
  const accountSemiSubGroupRows = accountSemiSubGroups.map((row) => ({ ...row }))
  const accountSubGroupRows = accountSubGroups.map((row) => ({ ...row }))

  const applyFilters = (rows, filters) =>
    rows.filter((row) => filters.every(({ column, value }) => row[column] === value))

  const buildQueryResult = (table, filters) => {
    const rows =
      table === "payment_modes"
        ? paymentModeRows
        : table === "account_heads"
          ? accountHeadRows
          : table === "account_groups"
            ? accountGroupRows
            : table === "account_semi_sub_groups"
              ? accountSemiSubGroupRows
              : table === "account_sub_groups"
                ? accountSubGroupRows
                : []
    return {
      data: applyFilters(rows, filters),
      error: null,
    }
  }

  return {
    from(table) {
      let filters = []
      let pendingUpdate = null

      const query = {
        select() {
          return query
        },
        update(values) {
          pendingUpdate = values
          return query
        },
        eq(column, value) {
          filters.push({ column, value })
          return query
        },
        async maybeSingle() {
          const result = buildQueryResult(table, filters)
          return { data: result.data[0] ?? null, error: result.error }
        },
        async single() {
          const rows =
            table === "payment_modes"
              ? paymentModeRows
              : table === "account_heads"
                ? accountHeadRows
                : table === "account_groups"
                  ? accountGroupRows
                  : table === "account_semi_sub_groups"
                    ? accountSemiSubGroupRows
                    : table === "account_sub_groups"
                      ? accountSubGroupRows
                      : []

          if (pendingUpdate) {
            const match = applyFilters(rows, filters)[0] ?? null

            if (!match) {
              return { data: null, error: { message: "Row not found." } }
            }

            Object.assign(match, pendingUpdate)
            return { data: match, error: null }
          }

          const result = buildQueryResult(table, filters)
          return { data: result.data[0] ?? null, error: result.error }
        },
      }

      query.then = (resolve, reject) => Promise.resolve(buildQueryResult(table, filters)).then(resolve, reject)

      return query
    },
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

test("selected existing payment mode self-heals missing account mapping", async () => {
  const supabase = createSupabaseStub({
    paymentModes: [paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: null })],
    accountHeads: [accountHead({ id: "cash-head", name: "Cash", sub_group_id: "sub-cash-bank" })],
  })

  const result = await resolveOrCreatePaymentMode(supabase, {
    clientId: "client-1",
    paymentModeId: "cash-mode",
  })

  assert.equal(result.success, true)
  assert.equal(result.paymentMode.account_head_id, "cash-head")
})

test("account-head resolution self-heals unmapped legacy payment mode", async () => {
  const supabase = createSupabaseStub({
    paymentModes: [paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: null })],
    accountHeads: [accountHead({ id: "cash-head", name: "Cash", sub_group_id: "sub-cash-bank" })],
  })

  const result = await resolvePaymentModeAccountHead(supabase, {
    clientId: "client-1",
    paymentMode: paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: null }),
  })

  assert.equal(result.success, true)
  assert.equal(result.accountHead.id, "cash-head")
})

test("invalid mapped head is repaired to the preferred cash-bank asset head", async () => {
  const supabase = createSupabaseStub({
    paymentModes: [paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: "wrong-head" })],
    accountHeads: [
      accountHead({ id: "wrong-head", name: "Cash", type: "liability", sub_group_id: "other-sub-group" }),
      accountHead({ id: "cash-head", name: "Cash", type: "asset", sub_group_id: "sub-cash-bank" }),
    ],
  })

  const result = await resolvePaymentModeAccountHead(supabase, {
    clientId: "client-1",
    paymentMode: paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: "wrong-head" }),
  })

  assert.equal(result.success, true)
  assert.equal(result.accountHead.id, "cash-head")
})

test("legacy null-type cash head is repaired from asset hierarchy", async () => {
  const supabase = createSupabaseStub({
    paymentModes: [paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: "cash-head" })],
    accountHeads: [accountHead({ id: "cash-head", name: "Cash", type: null, sub_group_id: "sub-cash-bank" })],
  })

  const result = await resolvePaymentModeAccountHead(supabase, {
    clientId: "client-1",
    paymentMode: paymentMode({ id: "cash-mode", name: "Cash", type: "cash", account_head_id: "cash-head" }),
  })

  assert.equal(result.success, true)
  assert.equal(result.accountHead.type, "asset")
})

after(async () => {
  await paymentModes.cleanup()
})
