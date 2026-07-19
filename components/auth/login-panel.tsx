"use client"

import dynamic from "next/dynamic"

const LoginForm = dynamic(
  () => import("@/components/auth/login-form").then((mod) => mod.LoginForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-5" aria-busy="true" aria-label="Loading sign in form" />
    ),
  }
)

type LoginPanelProps = {
  showRegisteredMessage?: boolean
}

export function LoginPanel({ showRegisteredMessage = false }: LoginPanelProps) {
  return <LoginForm showRegisteredMessage={showRegisteredMessage} />
}
