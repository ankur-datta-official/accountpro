const { spawn } = require("child_process")
const path = require("path")

require("./clean-next-artifacts.cjs")

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
const child = spawn(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => {
  process.exit(code ?? 0)
})
