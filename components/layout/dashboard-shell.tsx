"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
} from "lucide-react"

import { GlobalSearch } from "@/components/layout/GlobalSearch"
import { LogoutButton } from "@/components/layout/logout-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/clients/new": "Add New Client",
  "/team": "Team",
  "/settings": "Settings",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function SidebarContent({
  orgName,
  userName,
  pathname,
}: {
  orgName: string
  userName: string
  pathname: string
}) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-950">
            AP
          </div>
          <div>
            <p className="font-semibold">AccountPro</p>
            <p className="text-sm text-slate-400">{orgName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <Avatar className="h-10 w-10 border border-white/15">
            <AvatarFallback className="bg-slate-800 text-slate-100">
              {getInitials(userName || "A")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{orgName}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </div>
  )
}

export function DashboardShell({
  children,
  orgName,
  userName,
}: Readonly<{
  children: React.ReactNode
  orgName: string
  userName: string
}>) {
  const pathname = usePathname()
  const pageTitle = pageTitles[pathname] ?? "AccountPro"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60 print:hidden">
        <SidebarContent orgName={orgName} userName={userName} pathname={pathname} />
      </div>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur print:hidden">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="border-slate-200 bg-white">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 border-0 p-0">
                    <SidebarContent orgName={orgName} userName={userName} pathname={pathname} />
                  </SheetContent>
                </Sheet>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-950">{pageTitle}</p>
                <p className="text-sm text-slate-500">{orgName}</p>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <GlobalSearch />
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarFallback className="bg-slate-100 text-slate-700">
                  {getInitials(userName || "A")}
                </AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{userName}</p>
                <p className="text-xs text-slate-500">Signed in</p>
              </div>
            </div>
            <div className="md:hidden">
              <GlobalSearch />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 print:p-0">{children}</main>
      </div>
    </div>
  )
}
