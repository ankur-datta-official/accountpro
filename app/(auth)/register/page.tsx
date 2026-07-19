import { AuthFormHeader } from "@/components/layout/auth-form-header"
import { RegisterPanel } from "@/components/auth/register-panel"

export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return (
    <div>
      <AuthFormHeader
        title="Create your AccountPro workspace"
        description="Set up your organization and invite your team later from the dashboard."
      />

      <RegisterPanel />
    </div>
  )
}
