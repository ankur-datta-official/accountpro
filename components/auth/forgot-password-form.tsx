"use client"

import Link from "next/link"
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { getSupabaseConfigError } from "@/lib/supabase/env"

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

function buildRecoveryRedirect() {
  if (typeof window === "undefined") {
    return "/auth/callback?next=/reset-password"
  }

  return `${window.location.origin}/auth/callback?next=/reset-password`
}

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (values: ForgotPasswordValues) => {
    setIsSubmitting(true)

    try {
      const configError = getSupabaseConfigError()
      if (configError) {
        form.setError("email", { message: configError })
        return
      }

      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: buildRecoveryRedirect(),
      })

      setSubmittedEmail(values.email)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedEmail) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-emerald-700">
              <MailCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Check your email</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                If an account exists for <span className="font-medium">{submittedEmail}</span>, we have sent a password reset link.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          For security, this screen shows the same confirmation whether or not the email exists in the system.
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setSubmittedEmail("")}>
            Try another email
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : (
            <p className="text-sm text-slate-500">
              We&apos;ll email a secure recovery link if this account exists.
            </p>
          )}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-sm text-slate-500">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-slate-950 hover:text-slate-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
