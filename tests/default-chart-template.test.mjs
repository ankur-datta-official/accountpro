import assert from "node:assert/strict"
import { after } from "node:test"
import test from "node:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

async function loadTemplateModule() {
  const sourcePath = path.resolve("lib/accounting/default-chart-template.ts")
  const source = await readFile(sourcePath, "utf8")
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "default-chart-template-"))
  const modulePath = path.join(tempDir, "default-chart-template.mjs")
  await writeFile(modulePath, transpiled, "utf8")

  const loaded = await import(pathToFileURL(modulePath).href)
  return {
    ...loaded,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  }
}

const templateModule = await loadTemplateModule()
const { defaultChartTemplate } = templateModule

test("ships the smart Excel-derived default chart template", () => {
  const semiSubGroups = defaultChartTemplate.flatMap((group) => group.semiSubGroups)
  const subGroups = semiSubGroups.flatMap((semiSubGroup) => semiSubGroup.subGroups)
  const headPaths = subGroups.flatMap((subGroup) => subGroup.headPaths)

  assert.equal(defaultChartTemplate.length, 4)
  assert.equal(semiSubGroups.length, 15)
  assert.equal(subGroups.length, 34)
  assert.equal(headPaths.length, 318)
})

test("keeps income as grouped heads instead of one subgroup per account head", () => {
  const income = defaultChartTemplate.find((group) => group.name === "Income")
  const operatingIncome = income?.semiSubGroups.find(
    (semiSubGroup) => semiSubGroup.name === "Operating Income"
  )

  assert.ok(operatingIncome)
  assert.equal(operatingIncome.subGroups.length, 1)
  assert.equal(operatingIncome.subGroups[0].name, "Operating Income")
  assert.ok(
    operatingIncome.subGroups[0].headPaths.some(
      (path) => path.join(" > ") === "Sales Revenue"
    )
  )
})

test("preserves nested asset and receivable branches from the Excel template", () => {
  const currentAssets = defaultChartTemplate
    .find((group) => group.name === "Assets")
    ?.semiSubGroups.find((semiSubGroup) => semiSubGroup.name === "Current Assets")

  assert.ok(currentAssets)

  const cashAndCashEquivalents = currentAssets.subGroups.find(
    (subGroup) => subGroup.name === "Cash & Cash Equivalents"
  )
  const tradeAndOtherReceivables = currentAssets.subGroups.find(
    (subGroup) => subGroup.name === "Trade & Other Receivables"
  )

  assert.ok(cashAndCashEquivalents)
  assert.ok(tradeAndOtherReceivables)

  assert.ok(
    cashAndCashEquivalents.headPaths.some((path) => path.join(" > ") === "Cash in Hand > Head Office Cash")
  )
  assert.ok(
    tradeAndOtherReceivables.headPaths.some(
      (path) =>
        path.join(" > ") ===
        "Advances, Deposits & Prepayments > Advance Income Tax (AIT) > AIT – Salary TDS"
    )
  )
})

after(async () => {
  await templateModule.cleanup()
})
