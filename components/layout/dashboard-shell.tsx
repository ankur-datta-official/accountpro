"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  BarChart3,
  BookMarked,
  BookOpenText,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Landmark,
  Home,
  LineChart,
  Plus,
  ReceiptText,
  BadgeDollarSign,
  FileBadge2,
  ScrollText,
  Search,
  Settings,
  Users,
  UserCircle2,
} from "lucide-react"

import { GlobalSearch } from "@/components/layout/GlobalSearch"
import { UserAccountMenu } from "@/components/layout/user-account-menu"
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  buildClientPath,
  buildLegacyClientRouteSegment,
  extractClientIdFromRouteSegment,
} from "@/lib/routing/clients"
import type { OrganizationMemberRole } from "@/lib/types"
import { cn } from "@/lib/utils"

type SidebarClient = {
  id: string
  name: string
  type?: string | null
  routeSegment: string
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  aliases?: string[]
}

const workspaceItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/clients", label: "Organizations", icon: Building2, exact: true },
  { href: "/clients/new", label: "Add Organization", icon: Plus, exact: true },
]

const adminItems: NavItem[] = [
  { href: "/account", label: "My Account", icon: UserCircle2, exact: true },
  { href: "/team", label: "Team", icon: Users, exact: true },
  { href: "/settings", label: "Organization Settings", icon: Settings, exact: true },
]

const clientModuleItems = (clientId: string): NavItem[] => [
  { href: `/clients/${clientId}`, label: "Organization Dashboard", icon: BarChart3, exact: true },
]

const booksOfAccountsItems = (clientId: string): NavItem[] => [
  {
    href: `/clients/${clientId}/vouchers/new`,
    label: "Add New Voucher",
    icon: Plus,
    exact: true,
  },
  {
    href: `/clients/${clientId}/vouchers`,
    label: "Posted Vouchers",
    icon: ReceiptText,
    exact: true,
  },
  { href: `/clients/${clientId}/accounts`, label: "Chart of Accounts", icon: BookMarked },
  { href: `/clients/${clientId}/ledger`, label: "Ledger", icon: BookOpenText },
  {
    href: `/clients/${clientId}/day-book`,
    label: "Day Book",
    icon: ScrollText,
    aliases: [`/clients/${clientId}/daybook`],
  },
  { href: `/clients/${clientId}/trial-balance`, label: "Trial Balance", icon: FileSpreadsheet },
  { href: `/clients/${clientId}/payroll`, label: "Payroll", icon: BadgeDollarSign },
]

const financialStatementItems = (clientId: string): NavItem[] => [
  { href: `/clients/${clientId}/balance-sheet`, label: "Balance Sheet", icon: Landmark },
  { href: `/clients/${clientId}/profit-loss`, label: "Profit & Loss", icon: LineChart },
  { href: `/clients/${clientId}/salary-certificates`, label: "Salary Certificates", icon: FileBadge2 },
]

const clientSettingsItem = (clientId: string): NavItem => ({
  href: `/clients/${clientId}/settings`,
  label: "Organization Settings",
  icon: Settings,
  aliases: [
    `/clients/${clientId}/settings/fiscal-years`,
    `/clients/${clientId}/settings/payment-modes`,
  ],
})

const activeNavButtonClass =
  "!bg-slate-950 !text-white shadow-sm hover:!bg-slate-900 hover:!text-white focus-visible:!ring-slate-300 [&_svg]:!text-white"

function getCurrentClientId(pathname: string) {
  const match = pathname.match(/^\/clients\/([^/]+)/)
  if (!match?.[1] || match[1] === "new") return null
  return match[1]
}

function isItemActive(pathname: string, item: NavItem) {
  const candidates = [item.href, ...(item.aliases ?? [])]
  return candidates.some((href) => {
    if (item.exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  })
}

function getPageTitle(pathname: string, currentClient?: SidebarClient | null) {
  if (pathname === "/") return "Home"
  if (pathname === "/clients") return "Organizations"
  if (pathname === "/clients/new") return "Add New Organization"
  if (pathname === "/team") return "Team"
  if (pathname === "/settings") return "Organization Settings"
  if (pathname === "/account") return "My Account"

  if (currentClient) {
    const clientPath = buildClientPath(currentClient)
    const legacyClientPath = `/clients/${buildLegacyClientRouteSegment(currentClient)}`
    const clientRoutes: Array<[string, string]> = [
      [`${clientPath}/vouchers/new`, "Add New Voucher"],
      [`${clientPath}/vouchers`, "Posted Vouchers"],
      [`${clientPath}/accounts`, "Chart of Accounts"],
      [`${clientPath}/ledger`, "Ledger"],
      [`${clientPath}/daybook`, "Day Book"],
      [`${clientPath}/day-book`, "Day Book"],
      [`${clientPath}/trial-balance`, "Trial Balance"],
      [`${clientPath}/payroll`, "Payroll"],
      [`${clientPath}/balance-sheet`, "Balance Sheet"],
      [`${clientPath}/profit-loss`, "Profit & Loss"],
      [`${clientPath}/salary-certificates`, "Salary Certificates"],
      [`${clientPath}/bank-statements`, "Bank Statements"],
      [`${clientPath}/settings/fiscal-years`, "Fiscal Years"],
      [`${clientPath}/settings/payment-modes`, "Payment Modes"],
      [`${clientPath}/settings`, "Organization Settings"],
      [`${legacyClientPath}/vouchers/new`, "Add New Voucher"],
      [`${legacyClientPath}/vouchers`, "Posted Vouchers"],
      [`${legacyClientPath}/accounts`, "Chart of Accounts"],
      [`${legacyClientPath}/ledger`, "Ledger"],
      [`${legacyClientPath}/daybook`, "Day Book"],
      [`${legacyClientPath}/day-book`, "Day Book"],
      [`${legacyClientPath}/trial-balance`, "Trial Balance"],
      [`${legacyClientPath}/payroll`, "Payroll"],
      [`${legacyClientPath}/balance-sheet`, "Balance Sheet"],
      [`${legacyClientPath}/profit-loss`, "Profit & Loss"],
      [`${legacyClientPath}/salary-certificates`, "Salary Certificates"],
      [`${legacyClientPath}/bank-statements`, "Bank Statements"],
      [`${legacyClientPath}/settings/fiscal-years`, "Fiscal Years"],
      [`${legacyClientPath}/settings/payment-modes`, "Payment Modes"],
      [`${legacyClientPath}/settings`, "Organization Settings"],
    ]

    const route = clientRoutes.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    return route?.[1] ?? "Organization Dashboard"
  }

  return "DKLedger"
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
                    active && activeNavButtonClass
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

function ClientModuleSection({
  clientId,
  pathname,
}: {
  clientId: string
  pathname: string
}) {
  const dashboardItems = clientModuleItems(clientId)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Current Organization</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {dashboardItems.map((item) => {
            const Icon = item.icon
            const active = isItemActive(pathname, item)

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={cn("h-9 rounded-lg transition-colors", active && activeNavButtonClass)}
                >
                  <Link href={item.href} prefetch aria-current={active ? "page" : undefined}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          <CollapsibleNavGroup
            label="Books of Accounts"
            icon={BookOpenText}
            items={booksOfAccountsItems(clientId)}
            pathname={pathname}
          />
          <CollapsibleNavGroup
            label="Financial Statements"
            icon={FileSpreadsheet}
            items={financialStatementItems(clientId)}
            pathname={pathname}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function CollapsibleNavGroup({
  label,
  icon: Icon,
  items,
  pathname,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
  pathname: string
}) {
  const hasActiveItem = items.some((item) => isItemActive(pathname, item))
  const [open, setOpen] = useState(hasActiveItem)

  useEffect(() => {
    if (hasActiveItem) setOpen(true)
  }, [hasActiveItem])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip={label}
        aria-expanded={open}
        className={cn(
          "h-9 rounded-lg transition-colors",
          hasActiveItem && "bg-slate-50 font-semibold text-slate-950 hover:bg-slate-100 hover:text-slate-950"
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-slate-400 transition-transform group-data-[collapsible=icon]:hidden",
            open && "rotate-180 text-slate-600"
          )}
        />
      </SidebarMenuButton>

      {open ? (
        <SidebarMenuSub className="ml-4 mr-0 mt-1 gap-1 border-slate-200 py-1 pr-0">
          {items.map((item) => {
            const Icon = item.icon
            const active = isItemActive(pathname, item)

            return (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={active}
                  className={cn("h-8 rounded-lg text-sm transition-colors", active && activeNavButtonClass)}
                >
                  <Link href={item.href} prefetch aria-current={active ? "page" : undefined}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

function ClientSwitcher({
  clients,
  currentClient,
}: {
  clients: SidebarClient[]
  currentClient?: SidebarClient | null
}) {
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
                {currentClient?.name ?? "Select organization"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {currentClient ? "Current organization" : "Choose an organization"}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel>Active organizations</DropdownMenuLabel>
          <div className="p-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search organizations..."
                aria-label="Search organizations"
                autoFocus
                className="h-9 rounded-lg border-slate-200 bg-white pl-9 pr-3 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <DropdownMenuSeparator />
          {filteredClients.length ? (
            filteredClients.map((client) => (
              <DropdownMenuItem key={client.id} asChild>
                <Link href={buildClientPath(client)} prefetch className="cursor-pointer select-none">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{client.name}</span>
                </Link>
              </DropdownMenuItem>
            ))
          ) : clients.length ? (
            <DropdownMenuItem disabled>
              <Search className="h-4 w-4" />
              <span>No organizations found</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>No active organizations yet</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/clients/new" prefetch className="cursor-pointer select-none">
              <Plus className="h-4 w-4" />
              Add Organization
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/clients" prefetch className="cursor-pointer select-none">
              <ArrowUpRight className="h-4 w-4" />
              View All Organizations
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
function AppSidebar({
  orgName,
  clients,
  currentClient,
  pathname,
}: {
  orgName: string
  clients: SidebarClient[]
  currentClient?: SidebarClient | null
  pathname: string
}) {
  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white print:hidden">
      <SidebarHeader className="gap-4 border-b border-slate-200 px-3 py-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
            DK
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-slate-950">DKLedger</p>
            <p className="truncate text-xs text-slate-500">{orgName}</p>
          </div>
        </Link>
        <ClientSwitcher clients={clients} currentClient={currentClient} />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-1">
        <NavSection label="Workspace" items={workspaceItems} pathname={pathname} />

        {currentClient && (
          <>
            <SidebarSeparator />
            <ClientModuleSection clientId={currentClient.routeSegment} pathname={pathname} />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {(() => {
                    const item = clientSettingsItem(currentClient.routeSegment)
                    const Icon = item.icon
                    const active = isItemActive(pathname, item)

                    return (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn("h-9 rounded-lg transition-colors", active && activeNavButtonClass)}
                        >
                          <Link href={item.href} prefetch aria-current={active ? "page" : undefined}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })()}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavGroup
                label="Administration"
                icon={Users}
                items={adminItems}
                pathname={pathname}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}

export function DashboardShell({
  children,
  orgName,
  userName,
  userEmail,
  userRole,
  clients,
}: Readonly<{
  children: React.ReactNode
  orgName: string
  userName: string
  userEmail: string
  userRole: OrganizationMemberRole
  clients: SidebarClient[]
}>) {
  const pathname = usePathname()
  const currentClientId = getCurrentClientId(pathname)
  const currentClient =
    clients.find((client) => client.routeSegment === currentClientId) ??
    clients.find((client) => client.id === extractClientIdFromRouteSegment(currentClientId ?? "")) ??
    null
  const pageTitle = getPageTitle(pathname, currentClient)
  const pageSubtitle = currentClient?.name ?? orgName

  return (
    <SidebarProvider>
      <AppSidebar
        orgName={orgName}
        clients={clients}
        currentClient={currentClient}
        pathname={pathname}
      />
      <SidebarInset className="min-h-screen bg-slate-50 w-full max-w-full overflow-hidden">
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
              <UserAccountMenu userName={userName} userEmail={userEmail} userRole={userRole} orgName={orgName} />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 print:p-0 w-full max-w-full overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
