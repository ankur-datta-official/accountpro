const fs = require("fs")
const path = require("path")

const root = process.cwd()
const targetArg = process.argv[2]
const targets =
  targetArg === "production"
    ? [".next"]
    : targetArg === "development"
      ? [".next-app"]
      : [".next", ".next-app"]

for (const target of targets) {
  const fullPath = path.join(root, target)

  try {
    fs.rmSync(fullPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    })
  } catch (error) {
    console.warn(`Failed to remove ${target}:`, error.message)
  }
}
