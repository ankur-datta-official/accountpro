"use client"

import dynamic from "next/dynamic"

const RegisterForm = dynamic(
  () => import("@/components/auth/register-form").then((mod) => mod.RegisterForm),
  {
    ssr: false,
    loading: () => <div className="space-y-5" aria-busy="true" aria-label="Loading registration form" />,
  }
)

export function RegisterPanel() {
  return <RegisterForm />
}
