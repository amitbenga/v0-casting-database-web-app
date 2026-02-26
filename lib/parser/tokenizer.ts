/**
 * Lightweight Screenplay Tokenizer
 *
 * Converts raw text into a stream of typed tokens before the parser runs.
 * This replaces "raw regex on the whole file" with a structured intermediate
 * representation that the parser can consume without backtracking.
 *
 * Token types:
 *   CHARACTER    — ALL-CAPS name (possibly with parenthetical: V.O., CONT'D)
 *   DIALOGUE     — Indented text following a CHARACTER
 *   PARENTHETICAL— Indented (direction) between CHARACTER and DIALOGUE
 *   SCENE_HEADING— INT./EXT. lines
 *   TRANSITION   — CUT TO:, FADE OUT, etc.
 *   ACTION       — Non-dialogue text (stage directions)
 *   BLANK        — Empty line (significant as a block separator)
 *   SPEAKER_COLON— NAME: dialogue (pre-split format, e.g. dubbing scripts)
 *   TIMECODE     — Standalone timecode line
 *
 * Design:
 *   - Single-pass, line-by-line (no backtracking, O(n) performance)
 *   - Preserves original line numbers for diagnostics
 *   - No external dependencies (native RegExp only)
 */

import type { ParseDiagnostic } from "./diagnostics"

// ─── Token Types ─────────────────────────────────────────────────────────────

export type TokenType =
  | "CHARACTER"
  | "DIALOGUE"
  | "PARENTHETICAL"
  | "SCENE_HEADING"
  | "TRANSITION"
  | "ACTION"
  | "BLANK"
  | "SPEAKER_COLON"
  | "TIMECODE"

export interface Token {
  type: TokenType
  /** Raw text content of this line */
  text: string
  /** 1-based line number in source */
  line: number
  /** Number of leading spaces (for indentation-based parsing) */
  indent: number
  /** Extracted character name (for CHARACTER / SPEAKER_COLON tokens) */
  characterName?: string
  /** Dialogue or parenthetical text (for DIALOGUE / PARENTHETICAL / SPEAKER_COLON) */
  content?: string
}

export interface TokenizeResult {
  tokens: Token[]
  diagnostics: ParseDiagnostic[]
}

// ─── Patterns ────────────────────────────────────────────────────────────────

// Scene headings: INT., EXT., INT./EXT., I/E
const SCENE_HEADING_RE =
  /^\s*(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|I\/E\.?)\s+/i

// Transitions: CUT TO:, FADE OUT., DISSOLVE TO:, etc.
const TRANSITION_RE =
  /^\s*(CUT TO:|FADE (?:IN|OUT|TO BLACK)\.?|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|WIPE TO:|TIME CUT:)\s*$/i

// Timecodes: HH:MM:SS or HH:MM:SS:FF at line start
const TIMECODE_RE = /^\s*(\d{1,2}:\d{2}:\d{2}(?::\d{2})?)\s*$/

// Parentheticals: (whisper), (V.O.), etc. on their own line
const PARENTHETICAL_RE = /^\s*\(.*\)\s*$/

// Character name with optional parenthetical: JOHN, JOHN (V.O.), JOHN (CONT'D)
const CHARACTER_RE =
  /^(\s{5,})([A-Z\u05D0-\u05EA][A-Z0-9 \-'.\u05D0-\u05EA]{0,40})(\s*\(.*\))?\s*$/

// Speaker-colon format: NAME: dialogue (common in dubbing scripts)
const SPEAKER_COLON_RE =
  /^([A-Z\u05D0-\u05EA][A-Z0-9 \-'.\u05D0-\u05EA]{0,40}):\s+(.+)$/

// Standalone ALL-CAPS name (no indent required, shorter — for unformatted scripts)
const BARE_CHARACTER_RE =
  /^([A-Z\u05D0-\u05EA][A-Z0-9 \-'.\u05D0-\u05EA]{0,40})(\s*\(.*\))?\s*$/

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Tokenize screenplay text into a stream of typed tokens.
 * Single-pass, O(n) where n = number of lines.
 */
export function tokenize(text: string): TokenizeResult {
  const rawLines = text.split(/\r?\n/)
  const tokens: Token[] = []
  const diagnostics: ParseDiagnostic[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const lineNum = i + 1
    const trimmed = raw.trim()
    const indent = raw.length - raw.trimStart().length

    // ── BLANK ─────────────────────────────────────────────────────────────
    if (!trimmed) {
      tokens.push({ type: "BLANK", text: raw, line: lineNum, indent: 0 })
      continue
    }

    // ── TIMECODE ──────────────────────────────────────────────────────────
    const tcMatch = trimmed.match(TIMECODE_RE)
    if (tcMatch) {
      tokens.push({
        type: "TIMECODE",
        text: raw,
        line: lineNum,
        indent,
        content: tcMatch[1],
      })
      continue
    }

    // ── SCENE HEADING ─────────────────────────────────────────────────────
    if (SCENE_HEADING_RE.test(trimmed)) {
      tokens.push({ type: "SCENE_HEADING", text: raw, line: lineNum, indent, content: trimmed })
      continue
    }

    // ── TRANSITION ────────────────────────────────────────────────────────
    if (TRANSITION_RE.test(trimmed)) {
      tokens.push({ type: "TRANSITION", text: raw, line: lineNum, indent, content: trimmed })
      continue
    }

    // ── PARENTHETICAL (standalone line) ───────────────────────────────────
    if (PARENTHETICAL_RE.test(trimmed) && indent >= 5) {
      tokens.push({ type: "PARENTHETICAL", text: raw, line: lineNum, indent, content: trimmed })
      continue
    }

    // ── SPEAKER:COLON format ──────────────────────────────────────────────
    const colonMatch = trimmed.match(SPEAKER_COLON_RE)
    if (colonMatch) {
      tokens.push({
        type: "SPEAKER_COLON",
        text: raw,
        line: lineNum,
        indent,
        characterName: colonMatch[1].trim(),
        content: colonMatch[2].trim(),
      })
      continue
    }

    // ── CHARACTER (centered, indented ≥5 spaces) ──────────────────────────
    const charMatch = raw.match(CHARACTER_RE)
    if (charMatch) {
      const name = charMatch[2].trim()
      tokens.push({
        type: "CHARACTER",
        text: raw,
        line: lineNum,
        indent,
        characterName: name,
      })
      continue
    }

    // ── BARE CHARACTER (all-caps, no indent — for unformatted scripts) ────
    // Only match if it looks like a name: all-caps, short, and the NEXT line
    // is either blank or indented (lookahead check).
    if (indent < 5) {
      const bareMatch = trimmed.match(BARE_CHARACTER_RE)
      if (
        bareMatch &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length >= 2 &&
        trimmed.length <= 40 &&
        !/[.!?]$/.test(trimmed)
      ) {
        // Lookahead: next non-blank line should be indented or a parenthetical
        const nextIdx = rawLines.findIndex(
          (l, j) => j > i && l.trim().length > 0
        )
        if (
          nextIdx > -1 &&
          (rawLines[nextIdx].startsWith(" ") ||
            rawLines[nextIdx].startsWith("\t") ||
            PARENTHETICAL_RE.test(rawLines[nextIdx].trim()))
        ) {
          tokens.push({
            type: "CHARACTER",
            text: raw,
            line: lineNum,
            indent,
            characterName: bareMatch[1].trim(),
          })
          continue
        }
      }
    }

    // ── DIALOGUE (indented, following a character/parenthetical) ──────────
    if (indent >= 3) {
      // Check if the previous non-blank token is CHARACTER or PARENTHETICAL
      const prevToken = findPreviousNonBlank(tokens)
      if (
        prevToken &&
        (prevToken.type === "CHARACTER" ||
          prevToken.type === "PARENTHETICAL" ||
          prevToken.type === "DIALOGUE")
      ) {
        tokens.push({
          type: "DIALOGUE",
          text: raw,
          line: lineNum,
          indent,
          content: trimmed,
        })
        continue
      }
    }

    // ── ACTION (default) ──────────────────────────────────────────────────
    tokens.push({ type: "ACTION", text: raw, line: lineNum, indent, content: trimmed })
  }

  return { tokens, diagnostics }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findPreviousNonBlank(tokens: Token[]): Token | undefined {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type !== "BLANK") return tokens[i]
  }
  return undefined
}

/**
 * Group tokens into dialogue blocks: CHARACTER + their DIALOGUE lines.
 * Useful for extracting characters with their replica count.
 */
export interface DialogueBlock {
  characterName: string
  characterLine: number
  dialogueLines: { text: string; line: number }[]
}

export function groupDialogueBlocks(tokens: Token[]): DialogueBlock[] {
  const blocks: DialogueBlock[] = []
  let current: DialogueBlock | null = null

  for (const token of tokens) {
    if (token.type === "CHARACTER" || token.type === "SPEAKER_COLON") {
      // Start new block
      if (current) blocks.push(current)
      current = {
        characterName: token.characterName ?? token.text.trim(),
        characterLine: token.line,
        dialogueLines: [],
      }
      // SPEAKER_COLON has inline dialogue
      if (token.type === "SPEAKER_COLON" && token.content) {
        current.dialogueLines.push({ text: token.content, line: token.line })
      }
    } else if (
      token.type === "DIALOGUE" &&
      current &&
      token.content
    ) {
      current.dialogueLines.push({ text: token.content, line: token.line })
    } else if (
      token.type !== "BLANK" &&
      token.type !== "PARENTHETICAL" &&
      current
    ) {
      // Non-dialogue token → close current block
      blocks.push(current)
      current = null
    }
  }

  if (current) blocks.push(current)

  return blocks
}
