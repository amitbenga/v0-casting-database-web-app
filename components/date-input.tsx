"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value: string // yyyy-mm-dd format
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  className?: string
  id?: string
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

export function DateInput({ value, onChange, placeholder = "dd/mm/yyyy", min, max, className, id }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value))
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^\d/]/g, "")

    // Auto-add slashes after day and month
    const digits = raw.replace(/\//g, "")
    if (digits.length >= 2 && raw.length <= 3) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2)
    }
    if (digits.length >= 4 && raw.length <= 6) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4)
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

  function handleClear() {
    onChange("")
    setDisplayValue("")
  }

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
        className="pr-2 pl-10 text-right"
        maxLength={10}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-1 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">נקה תאריך</span>
        </Button>
      )}
    </div>
  )
}
