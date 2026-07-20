import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AuthFormHeader } from "@/components/layout/auth-form-header"

export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  return (
    <div>
      <AuthFormHeader
        title="Choose a new password"
        description="Finish the recovery process by setting a new secure password for your account."
      />

      <ResetPasswordForm />
    </div>
  )
}
