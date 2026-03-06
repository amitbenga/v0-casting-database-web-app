"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AI_MODELS, type AIModelId } from "@/lib/ai-config"
import { Bot } from "lucide-react"

interface AIModelSelectorProps {
  value: AIModelId
  onChange: (model: AIModelId) => void
  disabled?: boolean
}

export function AIModelSelector({ value, onChange, disabled }: AIModelSelectorProps) {
  const selected = AI_MODELS.find((m) => m.id === value)

  return (
    <div className="flex items-center gap-1.5">
      <Bot className="h-4 w-4 text-violet-500 flex-shrink-0" />
      <Select value={value} onValueChange={(v) => onChange(v as AIModelId)} disabled={disabled}>
        <SelectTrigger className="h-8 w-[200px] text-xs border-violet-200 dark:border-violet-800">
          <SelectValue>
            {selected ? (
              <span className="flex items-center gap-1.5">
                <span className="font-medium">{selected.label}</span>
                <span className="text-muted-foreground">({selected.cost})</span>
              </span>
            ) : (
              "בחר מודל"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {AI_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id} className="text-xs">
              <div className="flex flex-col py-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.label}</span>
                  <span className="text-muted-foreground text-[10px]">{model.provider}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{model.description}</span>
                  <span>·</span>
                  <span>{model.cost} per 1M tokens</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
