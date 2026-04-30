const { spawn } = require("child_process")
const path = require("path")

require("./clean-next-artifacts.cjs")

const serverPath = path.join(process.cwd(), "server.js")
const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => {
  process.exit(code ?? 0)
})
