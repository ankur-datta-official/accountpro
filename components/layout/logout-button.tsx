"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type LogoutButtonProps = {
  className?: string
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      toast.error(error.message)
      return
    }

    router.replace("/login")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("w-full justify-start text-slate-600 hover:bg-slate-100 hover:text-slate-900", className)}
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  )
}
