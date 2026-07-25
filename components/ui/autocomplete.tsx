"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

interface AutocompleteOption {
  value: string
  label: string
  id: string
  displayLabel?: string
  path?: string[]
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string
  onChange?: (value: string, option?: AutocompleteOption) => void
  onInputChange?: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  menuClassName?: string
  optionVariant?: "default" | "hierarchy"
  disabled?: boolean
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function getOptionSearchScore(option: AutocompleteOption, query: string) {
  if (!query) {
    return option.displayLabel ?? option.label
  }

  const displayLabel = normalizeText(option.displayLabel ?? "")
  const label = normalizeText(option.label)
  const path = (option.path ?? []).map(normalizeText)

  if (displayLabel.startsWith(query)) return `0-${displayLabel}`
  if (label.startsWith(query)) return `1-${label}`
  if (path.some((segment) => segment.startsWith(query))) return `2-${displayLabel}`
  if (displayLabel.includes(query)) return `3-${displayLabel}`
  if (label.includes(query)) return `4-${label}`
  if (path.some((segment) => segment.includes(query))) return `5-${displayLabel}`

  return null
}

function buildSecondaryLabel(option: AutocompleteOption) {
  if (!option.path?.length) {
    return option.label
  }

  if (option.path.length === 1) {
    return option.path[0]
  }

  return option.path.slice(0, -1).join(" / ")
}

function buildHierarchySegments(option: AutocompleteOption) {
  const path = option.path ?? []

  if (!path.length) {
    return {
      primarySegments: [] as string[],
      parentSegments: [] as string[],
      fallbackLabel: option.label,
    }
  }

  return {
    primarySegments: path.slice(0, Math.min(3, Math.max(path.length - 1, 0))),
    parentSegments: path.slice(3, -1),
    fallbackLabel: path.slice(0, -1).join(" / "),
  }
}

export function Autocomplete({
  options,
  value,
  onChange,
  onInputChange,
  placeholder = "Search...",
  className,
  inputClassName,
  menuClassName,
  optionVariant = "default",
  disabled = false,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const selectedOption = React.useMemo(
    () => options.find((option) => option.id === value),
    [options, value]
  )
  const normalizedInput = normalizeText(inputValue)

  React.useEffect(() => {
    setInputValue(selectedOption?.displayLabel ?? selectedOption?.label ?? "")
  }, [selectedOption])

  const filteredOptions = React.useMemo(() => {
    const ranked = options
      .map((option) => {
        const score = getOptionSearchScore(option, normalizedInput)

        return score ? { option, score } : null
      })
      .filter((entry): entry is { option: AutocompleteOption; score: string } => Boolean(entry))

    return ranked
      .sort((left, right) => left.score.localeCompare(right.score))
      .map((entry) => entry.option)
  }, [normalizedInput, options])

  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.displayLabel ?? option.label)
    onChange?.(option.id, option)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "Enter" && open && filteredOptions.length > 0) {
      handleOptionSelect(filteredOptions[0])
    } else if (!["ArrowUp", "ArrowDown"].includes(e.key)) {
      setOpen(true)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            onInputChange?.(e.target.value)
            if (!e.target.value) {
              onChange?.("", undefined)
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
          placeholder={placeholder}
          disabled={disabled}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && filteredOptions.length > 0 && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-50 mt-1 w-full min-w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white py-1 text-sm shadow-lg",
            menuClassName
          )}
        >
          <ul className="w-full">
            {filteredOptions.map((option) => {
              const hierarchy = buildHierarchySegments(option)

              return (
                <li
                  key={option.id}
                  onClick={() => handleOptionSelect(option)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-start gap-2 px-3 py-2.5 outline-none transition hover:bg-slate-50",
                    option.id === value && "bg-slate-50"
                  )}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {option.id === value && <Check className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-950">
                      {option.displayLabel ?? option.label}
                    </p>
                    {optionVariant === "hierarchy" ? (
                      <div className="mt-1.5 space-y-1.5">
                        {hierarchy.primarySegments.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {hierarchy.primarySegments.map((segment, segmentIndex) => (
                              <span
                                key={`${option.id}-${segment}-${segmentIndex}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-slate-600"
                              >
                                {segment}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="line-clamp-2 break-words text-xs leading-5 text-slate-500">
                          {hierarchy.parentSegments.length > 0
                            ? hierarchy.parentSegments.join(" / ")
                            : hierarchy.fallbackLabel}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                        {buildSecondaryLabel(option)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
