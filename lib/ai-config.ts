/**
 * AI model configuration — single source of truth.
 *
 * Set via environment variables in .env.local:
 *   AI_PARSE_MODEL=google/gemini-3-flash
 *   AI_TRANSLATE_MODEL=alibaba/qwen3.5-flash
 *
 * Vercel AI Gateway model string format: "provider/model-name"
 *
 * Recommended options (cheapest → most capable):
 * ┌──────────────────────────────────────┬────────────┬────────────┬──────────┐
 * │ Model                                │ Input $/1M │ Output $/1M│ Quality  │
 * ├──────────────────────────────────────┼────────────┼────────────┼──────────┤
 * │ alibaba/qwen3.5-flash               │ $0.10      │ ~$0.30     │ Good     │
 * │ google/gemini-3-flash                │ $0.50      │ $3.00      │ Great    │
 * │ anthropic/claude-haiku-4-5-20251001  │ $0.80      │ $4.00      │ Good     │
 * │ anthropic/claude-sonnet-4-20250514   │ $3.00      │ $15.00     │ Excellent│
 * │ alibaba/qwen3.5-plus                │ $1.20      │ ~$4.00     │ Great    │
 * │ anthropic/claude-opus-4-6            │ $15.00     │ $75.00     │ Best     │
 * └──────────────────────────────────────┴────────────┴────────────┴──────────┘
 */

/** Model used for script parsing (agentic tool-calling, needs good instruction following) */
export const AI_PARSE_MODEL =
  process.env.AI_PARSE_MODEL || "anthropic/claude-sonnet-4-20250514"

/** Model used for EN→HE translation (needs good multilingual + natural Hebrew) */
export const AI_TRANSLATE_MODEL =
  process.env.AI_TRANSLATE_MODEL || "anthropic/claude-sonnet-4-20250514"
