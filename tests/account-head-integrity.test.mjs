import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadIntegrityModule() {
  const sourcePath = path.resolve("lib/accounting/account-head-integrity.ts")
  const source = await readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "account-head-integrity-"))
  const modulePath = path.join(tempDir, "account-head-integrity.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

function head(overrides = {}) {
  return {
    id: "head",
    client_id: "client-1",
    sub_group_id: "sub-1",
    parent_id: null,
    name: "Head",
    sort_order: 0,
    is_active: true,
    ...overrides,
  }
}

const integrity = await loadIntegrityModule()
const {
  buildSafeAccountHeadForest,
  getAccountHeadPath,
  validateAccountHeadDeletion,
  validateParentAssignment,
} = integrity

test("rejects self-parent assignment", () => {
  const result = validateParentAssignment({
    headId: "self",
    parentId: "self",
    clientId: "client-1",
    subGroupId: "sub-1",
    heads: [head({ id: "self" })],
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "self_parent")
})

test("rejects circular parent assignment", () => {
  const heads = [
    head({ id: "a", parent_id: "b", name: "A" }),
    head({ id: "b", parent_id: null, name: "B" }),
  ]

  const result = validateParentAssignment({
    headId: "b",
    parentId: "a",
    clientId: "client-1",
    subGroupId: "sub-1",
    heads,
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "circular_parent")
})

test("rejects cross-client parent assignment for tenant isolation", () => {
  const result = validateParentAssignment({
    headId: "child",
    parentId: "foreign",
    clientId: "client-1",
    subGroupId: "sub-1",
    heads: [
      head({ id: "child", name: "Child" }),
      head({ id: "foreign", client_id: "client-2", name: "Foreign Parent" }),
    ],
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "cross_client_parent")
})

test("rejects cross-sub-group parent assignment during the legacy transition", () => {
  const result = validateParentAssignment({
    headId: "child",
    parentId: "parent",
    clientId: "client-1",
    subGroupId: "sub-1",
    heads: [
      head({ id: "child", sub_group_id: "sub-1", name: "Child" }),
      head({ id: "parent", sub_group_id: "sub-2", name: "Parent" }),
    ],
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "cross_sub_group_parent")
})

test("rejects deletion of a parent with children", () => {
  const result = validateAccountHeadDeletion({
    headId: "parent",
    heads: [
      head({ id: "parent", name: "Parent" }),
      head({ id: "child", parent_id: "parent", name: "Child" }),
    ],
    voucherReferenceCount: 0,
    payrollMappingCount: 0,
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "has_children")
})

test("rejects deletion of an account referenced by vouchers", () => {
  const result = validateAccountHeadDeletion({
    headId: "used",
    heads: [head({ id: "used", name: "Used Head" })],
    voucherReferenceCount: 2,
    payrollMappingCount: 0,
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, "has_voucher_references")
})

test("hierarchy traversal terminates safely on cycles", () => {
  const heads = [
    head({ id: "a", parent_id: "b", name: "A" }),
    head({ id: "b", parent_id: "a", name: "B" }),
  ]

  const path = getAccountHeadPath({
    head: heads[0],
    heads,
  })

  assert.deepEqual(path.map((item) => item.id), ["b", "a"])
})

test("legacy records remain readable during transition even with invalid parent metadata", () => {
  const forest = buildSafeAccountHeadForest([
    head({ id: "root", name: "Root", parent_id: null }),
    head({ id: "orphan", name: "Orphan", parent_id: "missing-parent" }),
    head({ id: "foreign-link", name: "Foreign Link", parent_id: "foreign-parent" }),
    head({
      id: "foreign-parent",
      client_id: "client-2",
      name: "Other Client Parent",
    }),
  ])

  assert.deepEqual(
    new Set(forest.map((item) => item.id)),
    new Set(["root", "orphan", "foreign-link", "foreign-parent"])
  )
})

after(async () => {
  await integrity.cleanup()
})
