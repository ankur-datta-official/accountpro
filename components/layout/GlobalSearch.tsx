"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type SearchItem = {
  id: string
  title: string
  subtitle: string
  href: string
}

type SearchResponse = {
  clients: SearchItem[]
  vouchers: SearchItem[]
  accountHeads: SearchItem[]
}

const RECENT_KEY = "accountpro-global-search-recent"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse>({
    clients: [],
    vouchers: [],
    accountHeads: [],
  })
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcutPressed = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"
      if (!shortcutPressed) return
      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENT_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as string[]
      setRecent(parsed.slice(0, 5))
    } catch {}
  }, [])

  useEffect(() => {
    if (!open) return
    if (!query.trim()) {
      setResults({
        clients: [],
        vouchers: [],
        accountHeads: [],
      })
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/search/global?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const payload = (await response.json().catch(() => null)) as SearchResponse | null
      setLoading(false)

      if (!response.ok || !payload) {
        setResults({ clients: [], vouchers: [], accountHeads: [] })
        return
      }

      setResults(payload)
    }, 220)

    return () => clearTimeout(timer)
  }, [open, query])

  const sections = useMemo(
    () => [
      { key: "clients", label: "Clients", items: results.clients },
      { key: "vouchers", label: "Vouchers", items: results.vouchers },
      { key: "accountHeads", label: "Account Heads", items: results.accountHeads },
    ],
    [results]
  )

  const handleSelect = (term: string) => {
    const next = [term, ...recent.filter((item) => item !== term)].slice(0, 5)
    setRecent(next)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 border-slate-200 bg-white text-slate-600">
          <Search className="h-4 w-4" />
          Search
          <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            Ctrl+K
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Global Search</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients, vouchers, account heads..."
        />

        {!query.trim() && recent.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent searches</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((term) => (
                <Button key={term} type="button" variant="outline" size="sm" onClick={() => setQuery(term)}>
                  {term}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-[420px] space-y-4 overflow-auto pr-1">
          {loading ? <p className="text-sm text-slate-500">Searching...</p> : null}
          {sections.map((section) => {
            if (!section.items.length) return null
            return (
              <div key={section.key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-slate-50"
                      onClick={() => handleSelect(query.trim())}
                    >
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
