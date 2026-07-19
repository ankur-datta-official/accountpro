const { spawn } = require("child_process")
const path = require("path")

process.argv[2] = "development"
require("./clean-next-artifacts.cjs")

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
const child = spawn(process.execPath, [nextBin, "dev", "--webpack"], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => {
  process.exit(code ?? 0)
})
