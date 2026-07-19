import { AuthFormHeader } from "@/components/layout/auth-form-header"
import { LoginPanel } from "@/components/auth/login-panel"

export const dynamic = "force-dynamic"

type LoginPageProps = {
  searchParams: Promise<{
    registered?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams
  const registered = Array.isArray(resolvedParams?.registered)
    ? resolvedParams?.registered[0]
    : resolvedParams?.registered

  return (
    <div>
      <AuthFormHeader
        title="Sign in to your workspace"
        description="Access your firm dashboard, client records, and reporting workspace."
      />

      <LoginPanel showRegisteredMessage={registered === "1"} />
    </div>
  )
}
