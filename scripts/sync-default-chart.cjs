const fs = require("fs")
const os = require("os")
const path = require("path")

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") })
require("dotenv").config()

const ts = require("typescript")
const { createClient } = require("@supabase/supabase-js")

async function loadDefaultsModule() {
  const templateSourcePath = path.resolve(process.cwd(), "lib/accounting/default-chart-template.ts")
  const templateSource = fs.readFileSync(templateSourcePath, "utf8")
  const transpiledTemplate = ts.transpileModule(templateSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: templateSourcePath,
  }).outputText

  const defaultsSourcePath = path.resolve(process.cwd(), "lib/accounting/defaults.ts")
  let defaultsSource = fs.readFileSync(defaultsSourcePath, "utf8")
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

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "accountpro-default-chart-"))
  const templateModulePath = path.join(tempDir, "default-chart-template.mjs")
  const defaultsModulePath = path.join(tempDir, "defaults.mjs")
  fs.writeFileSync(templateModulePath, transpiledTemplate, "utf8")
  fs.writeFileSync(defaultsModulePath, transpiledDefaults, "utf8")

  const loaded = await import(`file:///${defaultsModulePath.replace(/\\/g, "/")}`)
  return {
    ...loaded,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  }
}

function parseArgs(argv) {
  const args = {
    apply: false,
    client: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index]

    if (part === "--apply") {
      args.apply = true
      continue
    }

    if (part === "--client") {
      args.client = argv[index + 1] ?? null
      index += 1
      continue
    }
  }

  return args
}

async function main() {
  const { apply, client: clientFilter } = parseArgs(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const defaults = await loadDefaultsModule()

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: clients, error } = await supabase
      .from("clients")
      .select("id,name,is_active")
      .order("name")

    if (error) {
      throw new Error(error.message ?? "Unable to load clients.")
    }

    const filteredClients = (clients ?? []).filter((client) => {
      if (!clientFilter) {
        return true
      }

      const normalizedFilter = clientFilter.trim().toLowerCase()
      return (
        client.id.toLowerCase() === normalizedFilter ||
        client.name.trim().toLowerCase() === normalizedFilter
      )
    })

    if (filteredClients.length === 0) {
      console.error(`No clients matched filter: ${clientFilter}`)
      process.exit(1)
    }

    console.log(
      `${apply ? "Applying" : "Dry run for"} ${filteredClients.length} client(s): ${filteredClients
        .map((client) => `${client.name} (${client.id})`)
        .join(", ")}`
    )

    if (!apply) {
      console.log("Add --apply to write missing default chart accounts.")
      return
    }

    for (const client of filteredClients) {
      await defaults.createDefaultChartOfAccounts(client.id, supabase)
      console.log(`Synced default chart for ${client.name} (${client.id})`)
    }

    console.log("Default chart sync completed.")
  } finally {
    defaults.cleanup()
  }
}

main().catch((error) => {
  console.error("Default chart sync failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
