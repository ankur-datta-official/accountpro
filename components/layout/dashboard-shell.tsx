"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  BookMarked,
  BookOpenText,
  Building2,
  ChevronDown,
  FilePlus2,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LineChart,
  Plus,
  ReceiptText,
  ScrollText,
  Search,
  Settings,
  Settings2,
  Upload,
  Users,
  WalletCards,
} from "lucide-react"

import { GlobalSearch } from "@/components/layout/GlobalSearch"
import { LogoutButton } from "@/components/layout/logout-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type SidebarClient = {
  id: string
  name: string
  type?: string | null
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  aliases?: string[]
  exclude?: string[]
  emphasis?: boolean
}

const workspaceItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/clients", label: "Clients", icon: Building2, exact: true },
  { href: "/clients/new", label: "Add Client", icon: Plus, exact: true },
]

const adminItems: NavItem[] = [
  { href: "/team", label: "Team", icon: Users, exact: true },
  { href: "/settings", label: "Organization Settings", icon: Settings, exact: true },
]

const clientModuleItems = (clientId: string): NavItem[] => [
  { href: `/clients/${clientId}`, label: "Client Dashboard", icon: BarChart3, exact: true },
  { href: `/clients/${clientId}/vouchers/new`, label: "New Voucher", icon: FilePlus2, exact: true, emphasis: true },
  {
    href: `/clients/${clientId}/vouchers`,
    label: "Vouchers",
    icon: ReceiptText,
    exclude: [
      `/clients/${clientId}/vouchers/new`,
      `/clients/${clientId}/vouchers/opening-balance`,
    ],
  },
  { href: `/clients/${clientId}/vouchers/opening-balance`, label: "Opening Balances", icon: Banknote },
  { href: `/clients/${clientId}/accounts`, label: "Chart of Accounts", icon: BookMarked },
  { href: `/clients/${clientId}/ledger`, label: "Ledger", icon: BookOpenText },
  { href: `/clients/${clientId}/import`, label: "Import", icon: Upload },
]

const reportItems = (clientId: string): NavItem[] => [
  {
    href: `/clients/${clientId}/day-book`,
    label: "Day Book",
    icon: ScrollText,
    aliases: [`/clients/${clientId}/daybook`],
  },
  { href: `/clients/${clientId}/trial-balance`, label: "Trial Balance", icon: FileSpreadsheet },
  { href: `/clients/${clientId}/balance-sheet`, label: "Balance Sheet", icon: Landmark },
  { href: `/clients/${clientId}/profit-loss`, label: "Profit & Loss", icon: LineChart },
  { href: `/clients/${clientId}/bank-statements`, label: "Bank Statements", icon: WalletCards },
]

const clientSettingsItems = (clientId: string): NavItem[] => [
  { href: `/clients/${clientId}/settings`, label: "Settings", icon: Settings2, exact: true },
  { href: `/clients/${clientId}/settings/fiscal-years`, label: "Fiscal Years", icon: FileSpreadsheet },
  { href: `/clients/${clientId}/settings/payment-modes`, label: "Payment Modes", icon: WalletCards },
]

const activeNavButtonClass =
  "!bg-slate-950 !text-white shadow-sm hover:!bg-slate-900 hover:!text-white focus-visible:!ring-slate-300 [&_svg]:!text-white"

const inactiveEmphasisClass =
  "bg-slate-50 text-slate-950 hover:bg-slate-100 hover:text-slate-950"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function getCurrentClientId(pathname: string) {
  const match = pathname.match(/^\/clients\/([^/]+)/)
  if (!match?.[1] || match[1] === "new") return null
  return match[1]
}

function isItemActive(pathname: string, item: NavItem) {
  if (item.exclude?.some((href) => pathname === href || pathname.startsWith(`${href}/`))) {
    return false
  }

  const candidates = [item.href, ...(item.aliases ?? [])]
  return candidates.some((href) => {
    if (item.exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  })
}

function getPageTitle(pathname: string, currentClient?: SidebarClient | null) {
  if (pathname === "/") return "Dashboard"
  if (pathname === "/clients") return "Clients"
  if (pathname === "/clients/new") return "Add New Client"
  if (pathname === "/team") return "Team"
  if (pathname === "/settings") return "Organization Settings"

  if (currentClient) {
    const clientId = currentClient.id
    const clientRoutes: Array<[string, string]> = [
      [`/clients/${clientId}/vouchers/opening-balance`, "Opening Balances"],
      [`/clients/${clientId}/vouchers/new`, "New Voucher"],
      [`/clients/${clientId}/vouchers`, "Vouchers"],
      [`/clients/${clientId}/accounts`, "Chart of Accounts"],
      [`/clients/${clientId}/ledger`, "Ledger"],
      [`/clients/${clientId}/daybook`, "Day Book"],
      [`/clients/${clientId}/day-book`, "Day Book"],
      [`/clients/${clientId}/trial-balance`, "Trial Balance"],
      [`/clients/${clientId}/balance-sheet`, "Balance Sheet"],
      [`/clients/${clientId}/profit-loss`, "Profit & Loss"],
      [`/clients/${clientId}/bank-statements`, "Bank Statements"],
      [`/clients/${clientId}/import`, "Import"],
      [`/clients/${clientId}/settings/fiscal-years`, "Fiscal Years"],
      [`/clients/${clientId}/settings/payment-modes`, "Payment Modes"],
      [`/clients/${clientId}/settings`, "Client Settings"],
    ]

    const route = clientRoutes.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    return route?.[1] ?? "Client Dashboard"
  }

  return "AccountPro"
}

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon
            const active = isItemActive(pathname, item)

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={cn(
                    "h-9 rounded-lg transition-colors",
                    active && activeNavButtonClass,
                    item.emphasis && !active && inactiveEmphasisClass
                  )}
                >
                  <Link href={item.href} prefetch aria-current={active ? "page" : undefined}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ClientSelectSection({ clients }: { clients: SidebarClient[] }) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients

    return clients.filter((client) => {
      const name = client.name.toLowerCase()
      const type = client.type?.toLowerCase() ?? ""
      return name.includes(normalizedQuery) || type.includes(normalizedQuery)
    })
  }, [clients, normalizedQuery])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Select client</SidebarGroupLabel>
      <SidebarGroupContent className="space-y-2">
        {clients.length ? (
          <div className="relative group-data-[collapsible=icon]:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients..."
              aria-label="Search clients"
              className="h-9 rounded-lg border-slate-200 bg-white pl-9 pr-3 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0"
            />
          </div>
        ) : null}

        <SidebarMenu>
          {filteredClients.length ? (
            filteredClients.map((client) => (
              <SidebarMenuItem key={client.id}>
                <SidebarMenuButton asChild tooltip={client.name} className="h-9 rounded-lg">
                  <Link href={`/clients/${client.id}`} prefetch>
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{client.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          ) : clients.length ? (
            <SidebarMenuItem>
              <SidebarMenuButton disabled tooltip="No clients found" className="h-9 rounded-lg">
                <Search className="h-4 w-4" />
                <span>No clients found</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Add Client" className="h-9 rounded-lg">
                <Link href="/clients/new" prefetch>
                  <Plus className="h-4 w-4" />
                  <span>Add Client</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ClientSwitcher({
  clients,
  currentClient,
}: {
  clients: SidebarClient[]
  currentClient?: SidebarClient | null
}) {
  return (
    <div className="px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-start gap-3 rounded-lg border-sidebar-border bg-white px-3 py-2 text-left shadow-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-slate-950">
                {currentClient?.name ?? "Select client"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {currentClient ? "Current workspace" : "Choose a workspace"}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Active clients</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clients.length ? (
            clients.slice(0, 10).map((client) => (
              <DropdownMenuItem key={client.id} asChild>
                <Link href={`/clients/${client.id}`} prefetch className="cursor-pointer">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{client.name}</span>
                </Link>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No active clients yet</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/clients/new" prefetch className="cursor-pointer">
              <Plus className="h-4 w-4" />
              Add Client
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/clients" prefetch className="cursor-pointer">
              <ArrowUpRight className="h-4 w-4" />
              View All Clients
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function AppSidebar({
  orgName,
  userName,
  clients,
  currentClient,
  pathname,
}: {
  orgName: string
  userName: string
  clients: SidebarClient[]
  currentClient?: SidebarClient | null
  pathname: string
}) {
  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white print:hidden">
      <SidebarHeader className="gap-4 border-b border-slate-200 px-3 py-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
            AP
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-slate-950">AccountPro</p>
            <p className="truncate text-xs text-slate-500">{orgName}</p>
          </div>
        </Link>
        <ClientSwitcher clients={clients} currentClient={currentClient} />
      </SidebarHeader>

      <SidebarContent className="gap-1 px-2 py-3">
        <NavSection label="Workspace" items={workspaceItems} pathname={pathname} />

        {currentClient ? (
          <>
            <SidebarSeparator />
            <NavSection label="Current Client" items={clientModuleItems(currentClient.id)} pathname={pathname} />
            <NavSection label="Reports" items={reportItems(currentClient.id)} pathname={pathname} />
            <NavSection label="Client Settings" items={clientSettingsItems(currentClient.id)} pathname={pathname} />
          </>
        ) : (
          <ClientSelectSection clients={clients} />
        )}

        <SidebarSeparator />
        <NavSection label="Administration" items={adminItems} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 group-data-[collapsible=icon]:justify-center">
          <Avatar className="h-8 w-8 border border-slate-200">
            <AvatarFallback className="bg-white text-slate-700">
              {getInitials(userName || "A")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">Signed in</p>
          </div>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <LogoutButton />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function DashboardShell({
  children,
  orgName,
  userName,
  clients,
}: Readonly<{
  children: React.ReactNode
  orgName: string
  userName: string
  clients: SidebarClient[]
}>) {
  const pathname = usePathname()
  const currentClientId = getCurrentClientId(pathname)
  const currentClient = clients.find((client) => client.id === currentClientId) ?? null
  const pageTitle = getPageTitle(pathname, currentClient)
  const pageSubtitle = currentClient?.name ?? orgName

  return (
    <SidebarProvider>
      <AppSidebar
        orgName={orgName}
        userName={userName}
        clients={clients}
        currentClient={currentClient}
        pathname={pathname}
      />
      <SidebarInset className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur print:hidden">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg border border-slate-200 bg-white" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-950">{pageTitle}</p>
                <p className="truncate text-sm text-slate-500">{pageSubtitle}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <GlobalSearch />
              <div className="hidden items-center gap-3 md:flex">
                <Avatar className="h-9 w-9 border border-slate-200">
                  <AvatarFallback className="bg-slate-100 text-slate-700">
                    {getInitials(userName || "A")}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 print:p-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
