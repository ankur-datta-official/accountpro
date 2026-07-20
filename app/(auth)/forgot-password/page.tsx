import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AuthFormHeader } from "@/components/layout/auth-form-header"

export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <div>
      <AuthFormHeader
        title="Reset your password"
        description="Request a secure recovery link to restore access to your workspace."
      />

      <ForgotPasswordForm />
    </div>
  )
}
