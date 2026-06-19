const fs = require("fs")
const path = require("path")

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") })
require("dotenv").config()

const { Client } = require("pg")

async function main() {
  const migrationFile = process.argv[2]

  if (!migrationFile) {
    console.error("Usage: node scripts/apply-sql-migration.cjs <path-to-sql-file>")
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Add your Supabase Postgres connection string to .env.local, then rerun."
    )
    console.error("Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)")
    process.exit(1)
  }

  const fullPath = path.resolve(process.cwd(), migrationFile)

  if (!fs.existsSync(fullPath)) {
    console.error(`Migration file not found: ${fullPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(fullPath, "utf8")
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log(`Applying migration: ${migrationFile}`)
    await client.query(sql)
    console.log("Migration applied successfully.")
  } catch (error) {
    console.error("Migration failed:", error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
