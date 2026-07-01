const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const { Client } = require("pg")

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") })
require("dotenv").config()

function getProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] ?? null
}

const POOLER_REGIONS = [
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "us-east-1",
  "eu-west-1",
]

function buildDatabaseUrlCandidates(projectRef, password) {
  const encodedPassword = encodeURIComponent(password)

  return [
    `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    ...POOLER_REGIONS.flatMap((region) => [
      `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    ]),
  ]
}

function upsertEnvValue(filePath, key, value) {
  const line = `${key}=${value}`
  let contents = ""

  if (fs.existsSync(filePath)) {
    contents = fs.readFileSync(filePath, "utf8")
    const pattern = new RegExp(`^${key}=.*$`, "m")
    if (pattern.test(contents)) {
      contents = contents.replace(pattern, line)
    } else {
      contents = `${contents.trimEnd()}\n${line}\n`
    }
  } else {
    contents = `${line}\n`
  }

  fs.writeFileSync(filePath, contents)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function verifyConnection(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.query("select 1")
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function resolveWorkingDatabaseUrl(projectRef, password) {
  const candidates = buildDatabaseUrlCandidates(projectRef, password)

  for (const candidate of candidates) {
    try {
      await verifyConnection(candidate)
      return candidate
    } catch {
      continue
    }
  }

  throw new Error("Could not connect with direct host or common Supabase pooler regions.")
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local")
  const projectRef = getProjectRef()
  const password = process.env.SUPABASE_DB_PASSWORD

  if (!projectRef) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is missing or invalid in .env.local")
    process.exit(1)
  }

  if (!process.env.DATABASE_URL && !password) {
    console.error("Add one of these to .env.local before running db setup:")
    console.error("  SUPABASE_DB_PASSWORD=<your Supabase database password>")
    console.error("  DATABASE_URL=postgresql://postgres:...@db.<project-ref>.supabase.co:5432/postgres")
    console.error("")
    console.error("Supabase Dashboard -> Project Settings -> Database -> Database password")
    process.exit(1)
  }

  let connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

  if (!connectionString && password) {
    console.log("Resolving Supabase Postgres connection...")
    connectionString = await resolveWorkingDatabaseUrl(projectRef, password)
    upsertEnvValue(envPath, "DATABASE_URL", connectionString)
    upsertEnvValue(envPath, "DIRECT_URL", connectionString)
    process.env.DATABASE_URL = connectionString
    process.env.DIRECT_URL = connectionString
    console.log("DATABASE_URL and DIRECT_URL were added to .env.local")
  } else {
    try {
      console.log("Checking database connection...")
      await verifyConnection(connectionString)
    } catch (error) {
      if (!password) {
        console.error("Unable to connect to Supabase Postgres.")
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
      }

      console.log("Stored DATABASE_URL failed. Resolving a working Supabase connection...")
      connectionString = await resolveWorkingDatabaseUrl(projectRef, password)
      upsertEnvValue(envPath, "DATABASE_URL", connectionString)
      upsertEnvValue(envPath, "DIRECT_URL", connectionString)
      process.env.DATABASE_URL = connectionString
      process.env.DIRECT_URL = connectionString
    }
  }

  console.log("Generating Prisma client...")
  run("npx", ["prisma", "generate"])

  console.log("Applying Prisma migrations...")
  const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    shell: process.platform === "win32",
    env: process.env,
    encoding: "utf8",
  })

  if (deploy.status === 0) {
    console.log(deploy.stdout || "Migrations applied.")
    console.log("Database is ready for payroll.")
    return
  }

  const deployOutput = `${deploy.stdout || ""}\n${deploy.stderr || ""}`

  if (!deployOutput.includes("P3005")) {
    process.stdout.write(deploy.stdout || "")
    process.stderr.write(deploy.stderr || "")
    process.exit(deploy.status ?? 1)
  }

  console.log("Existing Supabase schema detected. Applying payroll SQL directly...")
  run("npx", [
    "prisma",
    "db",
    "execute",
    "--file",
    "prisma/migrations/20250619000000_add_payroll_module/migration.sql",
  ])
  run("npx", ["prisma", "migrate", "resolve", "--applied", "20250619000000_add_payroll_module"])
  
  // Apply payroll policies migration if not already applied
  try {
    run("npx", [
      "prisma",
      "db",
      "execute",
      "--file",
      "prisma/migrations/20260630000000_add_payroll_policies/migration.sql",
    ])
    run("npx", ["prisma", "migrate", "resolve", "--applied", "20260630000000_add_payroll_policies"])
  } catch (e) {
    // If table already exists, this will fail, which is fine
    console.log("Payroll policies table might already exist, skipping.")
  }

  console.log("Database is ready for payroll.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
