import { readFile } from "node:fs/promises"
import path from "node:path"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default async function Icon() {
  const iconPath = path.join(process.cwd(), "public", "branding", "dkledger_favcon.png")
  const iconBuffer = await readFile(iconPath)

  return new Response(new Uint8Array(iconBuffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
