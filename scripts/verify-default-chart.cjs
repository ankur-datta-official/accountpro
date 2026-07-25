const fs = require("fs")
const os = require("os")
const path = require("path")

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") })
require("dotenv").config()

const ts = require("typescript")
const { createClient } = require("@supabase/supabase-js")

async function loadTemplateModule() {
  const templateSourcePath = path.resolve(process.cwd(), "lib/accounting/default-chart-template.ts")
  const templateSource = fs.readFileSync(templateSourcePath, "utf8")
  const transpiledTemplate = ts.transpileModule(templateSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: templateSourcePath,
  }).outputText

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "accountpro-default-chart-verify-"))
  const templateModulePath = path.join(tempDir, "default-chart-template.mjs")
  fs.writeFileSync(templateModulePath, transpiledTemplate, "utf8")

  const loaded = await import(`file:///${templateModulePath.replace(/\\/g, "/")}`)
  return {
    ...loaded,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  }
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

function buildTemplatePathSet(defaultChartTemplate) {
  const paths = []
  for (const group of defaultChartTemplate) {
    for (const semiSubGroup of group.semiSubGroups) {
      for (const subGroup of semiSubGroup.subGroups) {
        for (const headPath of subGroup.headPaths) {
          paths.push(
            [group.name, semiSubGroup.name, subGroup.name, ...headPath]
              .map(normalizeName)
              .join(" > ")
          )
        }
      }
    }
  }
  return new Set(paths)
}

function buildLivePathSet({ groups, semiSubGroups, subGroups, accountHeads }) {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const semiById = new Map(semiSubGroups.map((semiSubGroup) => [semiSubGroup.id, semiSubGroup]))
  const subById = new Map(subGroups.map((subGroup) => [subGroup.id, subGroup]))
  const headById = new Map(accountHeads.map((head) => [head.id, head]))

  function getHeadPath(head) {
    const names = []
    const seen = new Set()
    let current = head
    while (current && !seen.has(current.id)) {
      names.unshift(current.name)
      seen.add(current.id)
      current = current.parent_id ? headById.get(current.parent_id) ?? null : null
    }
    return names
  }

  const paths = []
  for (const head of accountHeads) {
    if (head.is_active === false) {
      continue
    }

    const subGroup = subById.get(head.sub_group_id)
    if (!subGroup) {
      continue
    }
    const semiSubGroup = semiById.get(subGroup.semi_sub_id)
    if (!semiSubGroup) {
      continue
    }
    const group = groupById.get(semiSubGroup.group_id)
    if (!group) {
      continue
    }

    const headPath = getHeadPath(head)
    paths.push(
      [group.name, semiSubGroup.name, subGroup.name, ...headPath]
        .map(normalizeName)
        .join(" > ")
    )
  }
  return new Set(paths)
}

function parseArgs(argv) {
  const args = {
    client: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index]
    if (part === "--client") {
      args.client = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function main() {
  const { client: clientFilter } = parseArgs(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const templateModule = await loadTemplateModule()

  try {
    const templatePathSet = buildTemplatePathSet(templateModule.defaultChartTemplate)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id,name")
      .order("name")

    if (clientsError) {
      throw new Error(clientsError.message ?? "Unable to load clients.")
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

    let hasMismatch = false

    for (const client of filteredClients) {
      const [groupsRes, semiRes, subRes, headsRes] = await Promise.all([
        supabase.from("account_groups").select("*").eq("client_id", client.id).order("sort_order"),
        supabase
          .from("account_semi_sub_groups")
          .select("*")
          .eq("client_id", client.id)
          .order("sort_order"),
        supabase.from("account_sub_groups").select("*").eq("client_id", client.id).order("sort_order"),
        supabase.from("account_heads").select("*").eq("client_id", client.id).order("sort_order"),
      ])

      const error = groupsRes.error ?? semiRes.error ?? subRes.error ?? headsRes.error
      if (error) {
        throw new Error(error.message ?? `Unable to load chart data for ${client.name}.`)
      }

      const livePathSet = buildLivePathSet({
        groups: groupsRes.data ?? [],
        semiSubGroups: semiRes.data ?? [],
        subGroups: subRes.data ?? [],
        accountHeads: headsRes.data ?? [],
      })

      const missing = [...templatePathSet].filter((pathKey) => !livePathSet.has(pathKey))
      const matched = templatePathSet.size - missing.length
      const percent = ((matched / templatePathSet.size) * 100).toFixed(1)

      console.log(`CLIENT\t${client.name}\t${client.id}`)
      console.log(
        `SUMMARY\tmatched=${matched}/${templatePathSet.size}\tmissing=${missing.length}\tcoverage=${percent}%`
      )

      if (missing.length > 0) {
        hasMismatch = true
        missing.slice(0, 20).forEach((pathKey) => console.log(`MISSING\t${pathKey}`))
      }
    }

    if (hasMismatch) {
      process.exitCode = 2
    }
  } finally {
    templateModule.cleanup()
  }
}

main().catch((error) => {
  console.error("Default chart verification failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
