"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"

// First install cmdk and @radix-ui/react-popover
// npm install cmdk @radix-ui/react-popover

interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-11 rounded-xl border-slate-200", className)}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[400px] p-0">
        <Command className="w-full">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput placeholder={searchPlaceholder} className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm">{emptyMessage}</CommandEmpty>
            <CommandGroup className="p-1">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange?.(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
