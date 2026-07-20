"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    const supabase = createClient()

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setHasRecoverySession(Boolean(session))
      setIsLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(Boolean(session))
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const onSubmit = async (values: ResetPasswordValues) => {
    setIsSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      setIsSubmitting(false)
      toast.error(error.message)
      return
    }

    await supabase.auth.signOut()
    setIsSubmitting(false)
    toast.success("Password updated successfully.")
    router.replace("/login?passwordReset=1")
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying your recovery session...
      </div>
    )
  }

  if (!hasRecoverySession) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Recovery link expired or invalid</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Open the latest reset email, or request a new secure recovery link to continue.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button asChild className="rounded-full">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Recovery session confirmed</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Set a strong new password to regain access to your workspace.
            </p>
          </div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" placeholder="Create a strong password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your new password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </div>
  )
}
