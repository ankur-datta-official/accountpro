"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { getSupabaseConfigError } from "@/lib/supabase/env"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

type LoginValues = z.infer<typeof loginSchema>

type LoginFormProps = {
  showRegisteredMessage?: boolean
  showPasswordResetMessage?: boolean
}

export function LoginForm({
  showRegisteredMessage = false,
  showPasswordResetMessage = false,
}: LoginFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  useEffect(() => {
    if (showRegisteredMessage) {
      toast.success("Account created. You can sign in now.")
    }
  }, [showRegisteredMessage])

  useEffect(() => {
    if (showPasswordResetMessage) {
      toast.success("Password updated. Please sign in with your new password.")
    }
  }, [showPasswordResetMessage])

  const onSubmit = async (values: LoginValues) => {
    setIsSubmitting(true)
    try {
      const configError = getSupabaseConfigError()
      if (configError) {
        toast.error(configError)
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      router.replace("/")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Forgot password
            </Link>
          </div>
          <Input id="password" type="password" placeholder="Enter your password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-slate-950 hover:text-slate-700">
          Register
        </Link>
      </p>
    </div>
  )
}
