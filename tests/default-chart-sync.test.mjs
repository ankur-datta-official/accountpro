import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadDefaultModules() {
  const templateSourcePath = path.resolve("lib/accounting/default-chart-template.ts")
  const templateSource = await readFile(templateSourcePath, "utf8")
  const transpiledTemplate = ts.transpileModule(templateSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: templateSourcePath,
  }).outputText

  const defaultsSourcePath = path.resolve("lib/accounting/defaults.ts")
  let defaultsSource = await readFile(defaultsSourcePath, "utf8")
  defaultsSource = defaultsSource.replace(
    /import\s+\{\s*createClient\s*\}\s+from\s+"@supabase\/supabase-js"\r?\n/,
    "const createClient = () => ({})\n"
  )
  defaultsSource = defaultsSource.replace(
    /from\s+"@\/lib\/accounting\/default-chart-template"/g,
    'from "./default-chart-template.mjs"'
  )

  const transpiledDefaults = ts.transpileModule(defaultsSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: defaultsSourcePath,
  }).outputText

  const tempRoot = path.resolve(".tmp-test-artifacts")
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, "default-chart-sync-"))
  const templateModulePath = path.join(tempDir, "default-chart-template.mjs")
  const defaultsModulePath = path.join(tempDir, "defaults.mjs")

  await writeFile(templateModulePath, transpiledTemplate, "utf8")
  await writeFile(defaultsModulePath, transpiledDefaults, "utf8")

  const templateModule = await import(pathToFileURL(templateModulePath).href)
  const defaultsModule = await import(pathToFileURL(defaultsModulePath).href)

  return {
    ...templateModule,
    ...defaultsModule,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

function createSupabaseStub(seed = {}) {
  const tables = {
    account_groups: [...(seed.account_groups ?? [])],
    account_semi_sub_groups: [...(seed.account_semi_sub_groups ?? [])],
    account_sub_groups: [...(seed.account_sub_groups ?? [])],
    account_heads: [...(seed.account_heads ?? [])],
  }

  const counters = new Map(
    Object.entries(tables).map(([table, rows]) => [
      table,
      rows.reduce((max, row) => {
        const match = String(row.id ?? "").match(/-(\d+)$/)
        return match ? Math.max(max, Number(match[1])) : max
      }, 0),
    ])
  )

  function clone(row) {
    return { ...row }
  }

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every(({ column, value }) => (row[column] ?? null) === value)
    )
  }

  function nextId(table) {
    const next = (counters.get(table) ?? 0) + 1
    counters.set(table, next)
    return `${table}-${next}`
  }

  function buildQuery(table) {
    const rows = tables[table]
    const filters = []
    let pendingInsert = null
    let pendingUpdate = null
    let pendingDelete = false

    const query = {
      select() {
        return query
      },
      eq(column, value) {
        filters.push({ column, value })
        return query
      },
      order() {
        return query
      },
      insert(payload) {
        pendingInsert = Array.isArray(payload) ? payload : [payload]
        return query
      },
      update(payload) {
        pendingUpdate = payload
        return query
      },
      delete() {
        pendingDelete = true
        return query
      },
      async maybeSingle() {
        const matched = applyFilters(rows, filters)
        return { data: matched[0] ? clone(matched[0]) : null, error: null }
      },
      async single() {
        if (pendingInsert) {
          const insertedRows = pendingInsert.map((item) => {
            const row = {
              created_at: null,
              ...item,
              id: item.id ?? nextId(table),
            }
            rows.push(row)
            return clone(row)
          })
          return { data: insertedRows[0] ?? null, error: null }
        }

        if (pendingUpdate) {
          const matched = applyFilters(rows, filters)
          const target = matched[0] ?? null
          if (!target) {
            return { data: null, error: { message: "Row not found." } }
          }

          Object.assign(target, pendingUpdate)
          return { data: clone(target), error: null }
        }

        if (pendingDelete) {
          const matched = applyFilters(rows, filters)
          for (const target of matched) {
            const index = rows.findIndex((row) => row.id === target.id)
            if (index >= 0) {
              rows.splice(index, 1)
            }
          }
          return { data: null, error: null }
        }

        const matched = applyFilters(rows, filters)
        return { data: matched[0] ? clone(matched[0]) : null, error: null }
      },
      then(resolve, reject) {
        if (pendingDelete) {
          const matched = applyFilters(rows, filters)
          for (const target of matched) {
            const index = rows.findIndex((row) => row.id === target.id)
            if (index >= 0) {
              rows.splice(index, 1)
            }
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject)
        }

        const matched = applyFilters(rows, filters).map(clone)
        return Promise.resolve({ data: matched, error: null }).then(resolve, reject)
      },
    }

    return query
  }

  return {
    tables,
    from(table) {
      if (!(table in tables)) {
        throw new Error(`Unsupported table ${table}`)
      }
      return buildQuery(table)
    },
  }
}

const defaults = await loadDefaultModules()
const { createDefaultChartOfAccounts, defaultChartTemplate } = defaults

test("default chart sync seeds the smart template and remains idempotent", async () => {
  const supabase = createSupabaseStub()
  const clientId = "client-1"

  await createDefaultChartOfAccounts(clientId, supabase)
  await createDefaultChartOfAccounts(clientId, supabase)

  const expectedGroupCount = defaultChartTemplate.length
  const expectedSemiCount = defaultChartTemplate.flatMap((group) => group.semiSubGroups).length
  const expectedSubCount = defaultChartTemplate
    .flatMap((group) => group.semiSubGroups)
    .flatMap((semiSubGroup) => semiSubGroup.subGroups).length
  const expectedTemplatePathCount = defaultChartTemplate
    .flatMap((group) => group.semiSubGroups)
    .flatMap((semiSubGroup) => semiSubGroup.subGroups)
    .flatMap((subGroup) => subGroup.headPaths).length

  assert.equal(supabase.tables.account_groups.length, expectedGroupCount)
  assert.equal(supabase.tables.account_semi_sub_groups.length, expectedSemiCount)
  assert.equal(supabase.tables.account_sub_groups.length, expectedSubCount)

  const headPathKeys = new Set(
    supabase.tables.account_heads.map((head) =>
      [
        head.sub_group_id,
        head.parent_id ?? "__root__",
        head.name.trim().toLowerCase(),
      ].join("|")
    )
  )
  assert.equal(headPathKeys.size, supabase.tables.account_heads.length)
  assert.ok(supabase.tables.account_heads.length > expectedTemplatePathCount)
})

test("payment mode heads land in the Excel-aligned cash subgroup", async () => {
  const supabase = createSupabaseStub()
  const clientId = "client-2"

  await createDefaultChartOfAccounts(clientId, supabase)

  const assetsGroup = supabase.tables.account_groups.find((group) => group.name === "Assets")
  assert.ok(assetsGroup)

  const currentAssetsSemi = supabase.tables.account_semi_sub_groups.find(
    (semiSubGroup) =>
      semiSubGroup.group_id === assetsGroup.id && semiSubGroup.name === "Current Assets"
  )
  assert.ok(currentAssetsSemi)

  const cashSubGroup = supabase.tables.account_sub_groups.find(
    (subGroup) =>
      subGroup.semi_sub_id === currentAssetsSemi.id &&
      subGroup.name === "Cash & Cash Equivalents"
  )
  assert.ok(cashSubGroup)

  const paymentModeHeads = supabase.tables.account_heads.filter(
    (head) =>
      head.sub_group_id === cashSubGroup.id &&
      ["Cash", "Mutual Bank", "Islami Bank", "Dhaka Bank", "ICB Islamic Bank"].includes(head.name)
  )

  assert.equal(paymentModeHeads.length, 5)
  assert.ok(paymentModeHeads.every((head) => head.parent_id === null))
  assert.ok(paymentModeHeads.every((head) => head.type === "asset"))
})

test("repair pass collapses the old flat income layout into the smart fallback subgroup", async () => {
  const clientId = "client-legacy"
  const supabase = createSupabaseStub({
    account_groups: [
      { id: "group-income", client_id: clientId, name: "Income", type: "income", sort_order: 0, created_at: null },
    ],
    account_semi_sub_groups: [
      {
        id: "semi-operating-income",
        client_id: clientId,
        group_id: "group-income",
        name: "Operating Income",
        sort_order: 0,
        created_at: null,
      },
    ],
    account_sub_groups: [
      {
        id: "sub-sales-revenue",
        client_id: clientId,
        semi_sub_id: "semi-operating-income",
        name: "Sales Revenue",
        sort_order: 0,
        created_at: null,
      },
      {
        id: "sub-export-revenue",
        client_id: clientId,
        semi_sub_id: "semi-operating-income",
        name: "Export Revenue",
        sort_order: 1,
        created_at: null,
      },
    ],
    account_heads: [
      {
        id: "head-sales-revenue",
        client_id: clientId,
        sub_group_id: "sub-sales-revenue",
        parent_id: null,
        name: "Sales Revenue",
        type: "income",
        opening_balance: 0,
        balance_type: "credit",
        is_active: true,
        sort_order: 0,
        created_at: null,
      },
      {
        id: "head-export-revenue",
        client_id: clientId,
        sub_group_id: "sub-export-revenue",
        parent_id: null,
        name: "Export Revenue",
        type: "income",
        opening_balance: 0,
        balance_type: "credit",
        is_active: true,
        sort_order: 0,
        created_at: null,
      },
    ],
  })

  await createDefaultChartOfAccounts(clientId, supabase)

  const operatingIncomeSubGroups = supabase.tables.account_sub_groups.filter(
    (subGroup) => subGroup.semi_sub_id === "semi-operating-income"
  )
  assert.ok(
    operatingIncomeSubGroups.some((subGroup) => subGroup.name === "Operating Income")
  )
  assert.ok(
    !operatingIncomeSubGroups.some((subGroup) => subGroup.name === "Sales Revenue")
  )
  assert.ok(
    !operatingIncomeSubGroups.some((subGroup) => subGroup.name === "Export Revenue")
  )

  const fallbackSubGroup = operatingIncomeSubGroups.find(
    (subGroup) => subGroup.name === "Operating Income"
  )
  assert.ok(fallbackSubGroup)

  const migratedIncomeHeads = supabase.tables.account_heads.filter(
    (head) =>
      head.sub_group_id === fallbackSubGroup.id &&
      ["Sales Revenue", "Export Revenue"].includes(head.name) &&
      head.parent_id === null
  )
  assert.equal(migratedIncomeHeads.length, 2)
})

after(async () => {
  await defaults.cleanup()
})
