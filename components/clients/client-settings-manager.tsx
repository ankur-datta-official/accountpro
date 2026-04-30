"use client"

import Link from "next/link"
import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Loader2, Power, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FiscalYearForm } from "@/components/clients/FiscalYearForm"
import { PaymentModeForm } from "@/components/clients/PaymentModeForm"
import { TogglePaymentModeButton } from "@/components/clients/toggle-payment-mode-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { clientTypeOptions, fiscalYearMonths } from "@/lib/accounting/clients"
import { createClient } from "@/lib/supabase/client"
import type { ClientType, PaymentModeType } from "@/lib/types"

type FiscalYearRow = {
  id: string
  label: string
  startDate: string
  endDate: string
  isActive: boolean
  isClosed: boolean
  voucherCount: number
  isBalanced: boolean
}

type PaymentModeRow = {
  id: string
  name: string
  type: PaymentModeType | null
  accountNo: string | null
  isActive: boolean
}

type ChartStats = {
  groupName: string
  totalHeads: number
}

type ClientSettingsManagerProps = {
  clientId: string
  initialClient: {
    name: string
    type: ClientType
    tin: string | null
    bin: string | null
    address: string | null
    phone: string | null
    email: string | null
    fiscalYearStart: number
  }
  fiscalYears: FiscalYearRow[]
  nextDefaultStartDate: string
  paymentModes: PaymentModeRow[]
  chartStats: ChartStats[]
}

const tabs = [
  { id: "profile", label: "Client Profile" },
  { id: "fiscalYears", label: "Fiscal Years" },
  { id: "paymentModes", label: "Payment Modes" },
  { id: "chartAccounts", label: "Chart of Accounts" },
] as const

type TabId = (typeof tabs)[number]["id"]

function getFiscalYearStatus(year: FiscalYearRow) {
  if (year.isClosed) return { label: "CLOSED", className: "bg-slate-100 text-slate-600" }
  if (year.isActive) return { label: "ACTIVE", className: "bg-emerald-100 text-emerald-700" }
  return { label: "FUTURE", className: "bg-blue-100 text-blue-700" }
}

export function ClientSettingsManager({
  clientId,
  initialClient,
  fiscalYears,
  nextDefaultStartDate,
  paymentModes,
  chartStats,
}: ClientSettingsManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [savingProfile, setSavingProfile] = useState(false)
  const [archivingClient, setArchivingClient] = useState(false)
  const [resettingDefaults, setResettingDefaults] = useState(false)
  const [closingYearId, setClosingYearId] = useState<string | null>(null)
  const [activatingYearId, setActivatingYearId] = useState<string | null>(null)

  const [name, setName] = useState(initialClient.name)
  const [type, setType] = useState<ClientType>(initialClient.type)
  const [tin, setTin] = useState(initialClient.tin ?? "")
  const [bin, setBin] = useState(initialClient.bin ?? "")
  const [address, setAddress] = useState(initialClient.address ?? "")
  const [phone, setPhone] = useState(initialClient.phone ?? "")
  const [email, setEmail] = useState(initialClient.email ?? "")
  const [fiscalYearStart, setFiscalYearStart] = useState(initialClient.fiscalYearStart)

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    const token = await getToken()
    if (!token) {
      setSavingProfile(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        type,
        tin,
        bin,
        address,
        phone,
        email,
        fiscal_year_start: fiscalYearStart,
      }),
    })

    const result = await response.json().catch(() => ({ error: "Unable to save client profile." }))
    setSavingProfile(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to save client profile.")
      return
    }

    toast.success("Client profile updated.")
    router.refresh()
  }

  const handleArchiveClient = async () => {
    setArchivingClient(true)
    const token = await getToken()
    if (!token) {
      setArchivingClient(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/deactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json().catch(() => ({ error: "Unable to archive client." }))
    setArchivingClient(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to archive client.")
      return
    }

    toast.success("Client archived.")
    router.replace("/clients")
    router.refresh()
  }

  const handleActivateYear = async (fiscalYearId: string) => {
    setActivatingYearId(fiscalYearId)
    const token = await getToken()
    if (!token) {
      setActivatingYearId(null)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/fiscal-years/${fiscalYearId}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json().catch(() => ({ error: "Unable to set active year." }))
    setActivatingYearId(null)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to set active year.")
      return
    }

    toast.success("Fiscal year set as active.")
    router.refresh()
  }

  const handleCloseYear = async (fiscalYearId: string) => {
    setClosingYearId(fiscalYearId)
    const token = await getToken()
    if (!token) {
      setClosingYearId(null)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/fiscal-years/${fiscalYearId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json().catch(() => ({ error: "Unable to close fiscal year." }))
    setClosingYearId(null)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to close fiscal year.")
      return
    }

    toast.success("Fiscal year closed.")
    router.refresh()
  }

  const handleResetDefaults = async () => {
    setResettingDefaults(true)
    const token = await getToken()
    if (!token) {
      setResettingDefaults(false)
      toast.error("Your session has expired. Please sign in again.")
      router.replace("/login")
      return
    }

    const response = await fetch(`/api/clients/${clientId}/chart-of-accounts/reset-defaults`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await response.json().catch(() => ({ error: "Unable to reset defaults." }))
    setResettingDefaults(false)

    if (!response.ok) {
      toast.error(result.error ?? "Unable to reset defaults.")
      return
    }

    toast.success("Default chart of accounts template added.")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[1.75rem] border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Client Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Manage profile, fiscal years, payment modes, and chart setup.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      {activeTab === "profile" ? (
        <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as ClientType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>TIN</Label>
              <Input value={tin} onChange={(event) => setTin(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>BIN</Label>
              <Input value={bin} onChange={(event) => setBin(event.target.value)} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label>Address</Label>
            <Textarea rows={4} value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>

          <div className="mt-5 max-w-xs space-y-2">
            <Label>Fiscal year start month</Label>
            <Select value={String(fiscalYearStart)} onValueChange={(value) => setFiscalYearStart(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearMonths.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Button variant="outline" type="button" disabled={archivingClient} onClick={handleArchiveClient}>
              <Power className="mr-2 h-4 w-4" />
              {archivingClient ? "Archiving..." : "Archive Client"}
            </Button>
            <Button type="button" disabled={savingProfile} onClick={handleSaveProfile}>
              {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === "fiscalYears" ? (
        <div className="space-y-5">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Fiscal Years</h3>
                <p className="mt-1 text-sm text-slate-500">Manage active, closed, and upcoming periods.</p>
              </div>
              <FiscalYearForm
                clientId={clientId}
                existingYears={fiscalYears.map((item) => ({
                  id: item.id,
                  start_date: item.startDate,
                  end_date: item.endDate,
                }))}
                defaultStartDate={nextDefaultStartDate}
              />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {fiscalYears.map((year) => {
              const status = getFiscalYearStatus(year)

              return (
                <Card key={year.id} className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-2xl font-semibold tracking-tight text-slate-950">{year.label}</h4>
                      <p className="mt-2 text-sm text-slate-500">
                        {format(parseISO(year.startDate), "MMM d, yyyy")} to {format(parseISO(year.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge className={`rounded-full ${status.className}`}>{status.label}</Badge>
                  </div>

                  <p className="mt-4 text-sm text-slate-600">Vouchers: {year.voucherCount}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={year.isActive || activatingYearId === year.id}
                      onClick={() => void handleActivateYear(year.id)}
                    >
                      {activatingYearId === year.id ? "Setting..." : "Set Active"}
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" disabled={year.isClosed}>
                          Close Year
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you sure you want to close {year.label}?</DialogTitle>
                          <DialogDescription>
                            This will prevent any new voucher entries for this period. Make sure Trial Balance is balanced before closing.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          Balance status: {year.isBalanced ? "Balanced" : "Not balanced"}
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            disabled={closingYearId === year.id}
                            onClick={() => void handleCloseYear(year.id)}
                          >
                            {closingYearId === year.id ? "Closing..." : "Confirm Close"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button asChild type="button" variant="ghost">
                      <Link href={`/clients/${clientId}/vouchers`}>View</Link>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "paymentModes" ? (
        <div className="space-y-5">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Payment Modes</h3>
                <p className="mt-1 text-sm text-slate-500">Manage bank accounts, cash books, and collection channels.</p>
              </div>
              <PaymentModeForm clientId={clientId} />
            </div>
          </Card>

          <Card className="rounded-[1.75rem] border-slate-200 bg-white p-4 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account No</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentModes.map((mode) => (
                  <TableRow key={mode.id}>
                    <TableCell className="font-medium text-slate-900">{mode.name}</TableCell>
                    <TableCell>{(mode.type ?? "other").replace("_", " ")}</TableCell>
                    <TableCell>{mode.accountNo || "—"}</TableCell>
                    <TableCell>
                      <Badge className={mode.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                        {mode.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PaymentModeForm
                          clientId={clientId}
                          mode={{
                            id: mode.id,
                            name: mode.name,
                            type: (mode.type ?? "other") as "bank" | "cash" | "mobile_banking" | "other",
                            account_no: mode.accountNo,
                            is_active: mode.isActive,
                          }}
                        />
                        <TogglePaymentModeButton clientId={clientId} paymentModeId={mode.id} isActive={mode.isActive} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : null}

      {activeTab === "chartAccounts" ? (
        <div className="space-y-5">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-950">Chart of Accounts</h3>
            <p className="mt-1 text-sm text-slate-500">Quick overview by group.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {chartStats.map((item) => (
                <div key={item.groupName} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-sm text-slate-500">{item.groupName}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{item.totalHeads} account heads</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                <p>This will add missing default accounts but won&apos;t delete existing ones.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/clients/${clientId}/accounts`}>Open Chart of Accounts</Link>
                </Button>
                <Button type="button" onClick={() => void handleResetDefaults()} disabled={resettingDefaults}>
                  {resettingDefaults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
