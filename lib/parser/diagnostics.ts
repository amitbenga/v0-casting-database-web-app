/**
 * Parser Diagnostics Module
 *
 * Structured diagnostics for every stage of the parsing pipeline.
 * Each diagnostic includes severity, source, message, and optional location.
 *
 * Usage:
 *   const diag = createDiagnostic("warning", "normalizer", "שורה שבורה אוחדה", 42)
 *   collector.add(diag)
 *   // At the end: collector.all() returns all diagnostics, sorted by severity
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warning" | "info"

export type DiagnosticSource =
  | "extraction"
  | "normalization"
  | "tokenizer"
  | "parser"
  | "content-detection"
  | "structured-parser"
  | "validation"
  | "pipeline"

export interface ParseDiagnostic {
  /** Severity level */
  severity: DiagnosticSeverity
  /** Human-readable message (Hebrew for user-facing, English for dev) */
  message: string
  /** Which pipeline stage produced this diagnostic */
  source: DiagnosticSource | string
  /** Line number in the source file (1-based) */
  line?: number
  /** Column number (1-based) */
  column?: number
  /** Snippet of the problematic content */
  context?: string
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDiagnostic(
  severity: DiagnosticSeverity,
  source: DiagnosticSource | string,
  message: string,
  line?: number,
  context?: string
): ParseDiagnostic {
  return { severity, source, message, line, context }
}

// ─── Collector ───────────────────────────────────────────────────────────────

/**
 * Accumulates diagnostics across multiple pipeline stages.
 * Call `add()` from each stage, then `all()` at the end.
 */
export class DiagnosticCollector {
  private items: ParseDiagnostic[] = []

  add(diag: ParseDiagnostic): void {
    this.items.push(diag)
  }

  addAll(diags: ParseDiagnostic[]): void {
    this.items.push(...diags)
  }

  error(source: DiagnosticSource | string, message: string, line?: number, context?: string): void {
    this.items.push(createDiagnostic("error", source, message, line, context))
  }

  warn(source: DiagnosticSource | string, message: string, line?: number, context?: string): void {
    this.items.push(createDiagnostic("warning", source, message, line, context))
  }

  info(source: DiagnosticSource | string, message: string, line?: number, context?: string): void {
    this.items.push(createDiagnostic("info", source, message, line, context))
  }

  /** All diagnostics sorted by severity (error → warning → info) */
  all(): ParseDiagnostic[] {
    const order: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 }
    return [...this.items].sort((a, b) => order[a.severity] - order[b.severity])
  }

  /** Only errors */
  errors(): ParseDiagnostic[] {
    return this.items.filter((d) => d.severity === "error")
  }

  /** Only warnings */
  warnings(): ParseDiagnostic[] {
    return this.items.filter((d) => d.severity === "warning")
  }

  hasErrors(): boolean {
    return this.items.some((d) => d.severity === "error")
  }

  count(): number {
    return this.items.length
  }

  /** Clear all diagnostics */
  clear(): void {
    this.items = []
  }

  /** Format all diagnostics as a single string (for logging) */
  format(): string {
    return this.all()
      .map((d) => {
        const loc = d.line ? `:${d.line}${d.column ? `:${d.column}` : ""}` : ""
        const ctx = d.context ? ` → "${d.context}"` : ""
        return `[${d.severity.toUpperCase()}] ${d.source}${loc}: ${d.message}${ctx}`
      })
      .join("\n")
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Summarize diagnostics for display in the UI.
 * Returns a short string like: "2 שגיאות, 5 אזהרות"
 */
export function summarizeDiagnostics(diags: ParseDiagnostic[]): string {
  const errors = diags.filter((d) => d.severity === "error").length
  const warnings = diags.filter((d) => d.severity === "warning").length
  const infos = diags.filter((d) => d.severity === "info").length

  const parts: string[] = []
  if (errors > 0) parts.push(`${errors} שגיאות`)
  if (warnings > 0) parts.push(`${warnings} אזהרות`)
  if (infos > 0) parts.push(`${infos} הערות`)

  return parts.join(", ") || "ללא בעיות"
}
