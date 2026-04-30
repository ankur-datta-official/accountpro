"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type FiscalYearContextOption = {
  id: string
  label: string
}

type FiscalYearContextValue = {
  clientId: string
  fiscalYears: FiscalYearContextOption[]
  selectedFiscalYearId: string | null
  setSelectedFiscalYearId: (value: string) => void
}

const FiscalYearContext = createContext<FiscalYearContextValue | null>(null)

export function FiscalYearProvider({
  children,
  clientId,
  fiscalYears,
  initialFiscalYearId,
}: {
  children: ReactNode
  clientId: string
  fiscalYears: FiscalYearContextOption[]
  initialFiscalYearId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const storageKey = `accountpro:fiscal-year:${clientId}`

  const [selectedFiscalYearId, setSelectedFiscalYearIdState] = useState<string | null>(
    initialFiscalYearId
  )

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const fromQuery = params.get("fiscalYear")
    const stored = window.localStorage.getItem(storageKey)
    const validIds = new Set(fiscalYears.map((year) => year.id))
    const selected = [fromQuery, stored, initialFiscalYearId].find(
      (value): value is string => Boolean(value && validIds.has(value))
    )

    setSelectedFiscalYearIdState(selected ?? null)

    if (selected && window.localStorage.getItem(storageKey) !== selected) {
      window.localStorage.setItem(storageKey, selected)
    }
  }, [fiscalYears, initialFiscalYearId, searchParamsString, storageKey])

  const setSelectedFiscalYearId = useCallback(
    (value: string) => {
      setSelectedFiscalYearIdState((current) => (current === value ? current : value))

      if (window.localStorage.getItem(storageKey) !== value) {
        window.localStorage.setItem(storageKey, value)
      }

      const nextParams = new URLSearchParams(searchParamsString)
      nextParams.set("fiscalYear", value)
      const targetUrl = `${pathname}?${nextParams.toString()}`
      router.replace(targetUrl, { scroll: false })
    },
    [pathname, router, searchParamsString, storageKey]
  )

  const contextValue = useMemo(
    () => ({
      clientId,
      fiscalYears,
      selectedFiscalYearId,
      setSelectedFiscalYearId,
    }),
    [clientId, fiscalYears, selectedFiscalYearId, setSelectedFiscalYearId]
  )

  return <FiscalYearContext.Provider value={contextValue}>{children}</FiscalYearContext.Provider>
}

export function useFiscalYearContext() {
  const context = useContext(FiscalYearContext)

  if (!context) {
    throw new Error("useFiscalYearContext must be used within FiscalYearProvider")
  }

  return context
}
