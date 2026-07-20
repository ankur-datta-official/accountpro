"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, ChevronDown, CreditCard, LogOut, Settings, ShieldCheck, UserCircle2, Users } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { formatRole } from "@/lib/team"
import type { OrganizationMemberRole } from "@/lib/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

type UserAccountMenuProps = {
  userName: string
  userEmail: string
  userRole: OrganizationMemberRole
  orgName: string
}

export function UserAccountMenu({
  userName,
  userEmail,
  userRole,
  orgName,
}: UserAccountMenuProps) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 max-w-[280px] items-center gap-3 rounded-full border-slate-200 bg-white pl-2 pr-3 shadow-none"
        >
          <Avatar className="h-7 w-7 border border-slate-200">
            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
              {getInitials(userName || "A")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-1 text-left sm:block">
            <p className="truncate text-sm font-medium text-slate-950">{userName}</p>
            <p className="truncate text-xs text-slate-500">{formatRole(userRole)}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-slate-200 p-2">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 border border-slate-200">
              <AvatarFallback className="bg-slate-100 font-semibold text-slate-700">
                {getInitials(userName || "A")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{userName}</p>
              <p className="truncate text-xs font-normal text-slate-500">{userEmail}</p>
              <p className="mt-1 truncate text-xs font-normal text-slate-500">
                {formatRole(userRole)} at {orgName}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account" className="cursor-pointer rounded-xl px-3 py-2">
            <UserCircle2 className="h-4 w-4" />
            My Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account#security" className="cursor-pointer rounded-xl px-3 py-2">
            <ShieldCheck className="h-4 w-4" />
            Security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/clients" className="cursor-pointer rounded-xl px-3 py-2">
            <Building2 className="h-4 w-4" />
            Switch Organization
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer rounded-xl px-3 py-2">
            <Settings className="h-4 w-4" />
            Organization Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/team" className="cursor-pointer rounded-xl px-3 py-2">
            <Users className="h-4 w-4" />
            Team & Access
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer rounded-xl px-3 py-2">
            <CreditCard className="h-4 w-4" />
            Plan & Billing
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleLogout()
          }}
          className="cursor-pointer rounded-xl px-3 py-2 text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
