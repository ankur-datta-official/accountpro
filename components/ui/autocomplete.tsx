"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"

interface AutocompleteOption {
  value: string
  label: string
  id: string
  displayLabel?: string
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string
  onChange?: (value: string, option?: AutocompleteOption) => void
  onInputChange?: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
}

export function Autocomplete({
  options,
  value,
  onChange,
  onInputChange,
  placeholder = "Search...",
  className,
  inputClassName,
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

  React.useEffect(() => {
    setInputValue(selectedOption?.displayLabel ?? selectedOption?.label ?? "")
  }, [selectedOption])

  const filteredOptions = options.filter((option) =>
    [option.label, option.displayLabel ?? ""].some((candidate) =>
      candidate.toLowerCase().includes(inputValue.toLowerCase())
    )
  )

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
          className="absolute z-50 mt-1 w-full min-w-[300px] max-w-[600px] max-h-80 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-md"
        >
          <ul className="w-full">
            {filteredOptions.map((option) => (
              <li
                key={option.id}
                onClick={() => handleOptionSelect(option)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 outline-none hover:bg-slate-100",
                  option.id === value && "bg-slate-50"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  {option.id === value && <Check className="h-4 w-4" />}
                </span>
                <span className="flex-1 whitespace-normal break-words">{option.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
