"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value: string // yyyy-mm-dd format
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  className?: string
  id?: string
  dir?: string
}

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return ""
  const [year, month, day] = isoDate.split("-")
  if (!year || !month || !day) return ""
  return `${day}/${month}/${year}`
}

function parseDisplayDate(display: string): string {
  const parts = display.replace(/[^\d/]/g, "").split("/")
  if (parts.length !== 3) return ""
  const [day, month, year] = parts
  if (!day || !month || !year || year.length !== 4) return ""
  const d = parseInt(day, 10)
  const m = parseInt(month, 10)
  const y = parseInt(year, 10)
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return ""
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

export function DateInput({ value, onChange, placeholder = "dd/mm/yyyy", min, max, className, id, dir }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value))
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value))
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^\d/]/g, "")

    // Auto-add slashes
    if (raw.length === 2 && !raw.includes("/")) {
      raw = raw + "/"
    } else if (raw.length === 5 && raw.indexOf("/") === 2 && raw.lastIndexOf("/") === 2) {
      raw = raw + "/"
    }

    // Limit length
    if (raw.length > 10) return

    setDisplayValue(raw)

    if (raw.length === 10) {
      const iso = parseDisplayDate(raw)
      if (iso) {
        onChange(iso)
      }
    }
  }

  function handleBlur() {
    if (displayValue && displayValue.length === 10) {
      const iso = parseDisplayDate(displayValue)
      if (iso) {
        onChange(iso)
      } else {
        setDisplayValue(formatDateForDisplay(value))
      }
    } else if (displayValue === "") {
      onChange("")
    } else {
      setDisplayValue(formatDateForDisplay(value))
    }
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (date) {
      const iso = date.toISOString().split("T")[0]
      onChange(iso)
      setOpen(false)
    }
  }

  function handleClear() {
    onChange("")
    setDisplayValue("")
  }

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        ref={inputRef}
        id={id}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        dir="ltr"
        className="pr-16 text-right"
        maxLength={10}
      />
      <div className="absolute left-1 flex items-center gap-0.5">
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              defaultMonth={selectedDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
