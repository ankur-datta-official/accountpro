import { NextResponse } from "next/server"
import { z } from "zod"

import { registerUser } from "@/lib/actions/auth"

const registerSchema = z
  .object({
    fullName: z.string().min(2),
    organizationName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = registerSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid registration data." },
      { status: 400 }
    )
  }

  const { fullName, organizationName, email, password } = parsed.data
  const result = await registerUser(fullName, organizationName, email, password)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    requiresEmailConfirmation: result.requiresEmailConfirmation,
  })
}
