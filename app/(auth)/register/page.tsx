import { AuthFormHeader } from "@/components/layout/auth-form-header"
import { RegisterPanel } from "@/components/auth/register-panel"

export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return (
    <div>
      <AuthFormHeader
        title="Create your DKLedger account"
        description="Create your login first. DKLedger platform owners can activate management access, and invited users can join their assigned workspace after sign-in."
      />

      <RegisterPanel />
    </div>
  )
}
