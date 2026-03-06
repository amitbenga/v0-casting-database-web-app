/**
 * AI model configuration — single source of truth.
 *
 * Vercel AI Gateway model string format: "provider/model-name"
 * Zero config — no API keys needed when deployed on Vercel.
 */

/** Available models for the UI selector */
export const AI_MODELS = [
  {
    id: "google/gemini-3-flash",
    label: "Gemini 3 Flash",
    provider: "Google",
    cost: "$0.50 / $3.00",
    quality: "Great",
    description: "Fast, cheap, great quality",
  },
  {
    id: "alibaba/qwen3.5-flash",
    label: "Qwen 3.5 Flash",
    provider: "Alibaba",
    cost: "$0.10 / $0.30",
    quality: "Good",
    description: "Cheapest option",
  },
  {
    id: "openai/gpt-5.2",
    label: "GPT 5.2",
    provider: "OpenAI",
    cost: "$2.00 / $8.00",
    quality: "Excellent",
    description: "OpenAI flagship",
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    cost: "$3.00 / $15.00",
    quality: "Excellent",
    description: "Best instruction following",
  },
  {
    id: "alibaba/qwen3.5-plus",
    label: "Qwen 3.5 Plus",
    provider: "Alibaba",
    cost: "$1.20 / $4.00",
    quality: "Great",
    description: "Strong + affordable",
  },
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    cost: "$0.80 / $4.00",
    quality: "Good",
    description: "Fast Anthropic option",
  },
] as const

export type AIModelId = (typeof AI_MODELS)[number]["id"]

/** Default model (env override or Sonnet 4) */
export const DEFAULT_PARSE_MODEL: AIModelId =
  (process.env.AI_PARSE_MODEL as AIModelId) || "anthropic/claude-sonnet-4-20250514"

export const DEFAULT_TRANSLATE_MODEL: AIModelId =
  (process.env.AI_TRANSLATE_MODEL as AIModelId) || "anthropic/claude-sonnet-4-20250514"

/** Server-side aliases (backwards compat) */
export const AI_PARSE_MODEL = DEFAULT_PARSE_MODEL
export const AI_TRANSLATE_MODEL = DEFAULT_TRANSLATE_MODEL
