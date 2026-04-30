"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AuthFormHeader } from "@/components/layout/auth-form-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    organizationName: z.string().min(2, "Organization name must be at least 2 characters."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: RegisterValues) => {
    setIsSubmitting(true)

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    })

    const result = await response.json().catch(() => ({ error: "Registration failed." }))
    setIsSubmitting(false)

    if (!response.ok) {
      toast.error(result.error ?? "Registration failed.")
      return
    }

    toast.success(
      result.requiresEmailConfirmation
        ? "Account created. Check your email to confirm your account."
        : "Account created successfully."
    )

    router.replace("/login?registered=1")
    router.refresh()
  }

  return (
    <div>
      <AuthFormHeader
        title="Create your AccountPro workspace"
        description="Set up your organization and invite your team later from the dashboard."
      />

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" placeholder="Jane Doe" {...form.register("fullName")} />
          {form.formState.errors.fullName ? (
            <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">Organization Name</Label>
          <Input id="organizationName" placeholder="Acme Accounting" {...form.register("organizationName")} />
          {form.formState.errors.organizationName ? (
            <p className="text-sm text-destructive">{form.formState.errors.organizationName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Create a password" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>

      <p className="mt-8 text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-950 hover:text-slate-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
