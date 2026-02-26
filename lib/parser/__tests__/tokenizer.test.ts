import { describe, it, expect } from "vitest"
import { tokenize, groupDialogueBlocks, type Token } from "../tokenizer"

// ─── Helper ──────────────────────────────────────────────────────────────────

function screenplay(lines: string[]): string {
  return lines.join("\n")
}

function types(tokens: Token[]): string[] {
  return tokens.map((t) => t.type)
}

// ─── Basic tokenization ─────────────────────────────────────────────────────

describe("tokenize — basic types", () => {
  it("detects BLANK lines", () => {
    const { tokens } = tokenize("\n\n\n")
    expect(tokens.every((t) => t.type === "BLANK")).toBe(true)
  })

  it("detects SCENE_HEADING", () => {
    const { tokens } = tokenize("INT. LIVING ROOM - DAY")
    expect(tokens[0].type).toBe("SCENE_HEADING")
  })

  it("detects EXT. heading", () => {
    const { tokens } = tokenize("EXT. PARK - NIGHT")
    expect(tokens[0].type).toBe("SCENE_HEADING")
  })

  it("detects INT./EXT. heading", () => {
    const { tokens } = tokenize("INT./EXT. CAR - MOVING - DAY")
    expect(tokens[0].type).toBe("SCENE_HEADING")
  })

  it("detects TRANSITION", () => {
    const { tokens } = tokenize("CUT TO:")
    expect(tokens[0].type).toBe("TRANSITION")
  })

  it("detects FADE OUT", () => {
    const { tokens } = tokenize("FADE OUT.")
    expect(tokens[0].type).toBe("TRANSITION")
  })

  it("detects TIMECODE", () => {
    const { tokens } = tokenize("00:01:23")
    expect(tokens[0].type).toBe("TIMECODE")
    expect(tokens[0].content).toBe("00:01:23")
  })

  it("detects TIMECODE with frames", () => {
    const { tokens } = tokenize("01:23:45:10")
    expect(tokens[0].type).toBe("TIMECODE")
  })

  it("detects SPEAKER_COLON format", () => {
    const { tokens } = tokenize("JOHN: Hello, how are you?")
    expect(tokens[0].type).toBe("SPEAKER_COLON")
    expect(tokens[0].characterName).toBe("JOHN")
    expect(tokens[0].content).toBe("Hello, how are you?")
  })

  it("detects centered CHARACTER (≥5 indent)", () => {
    const text = "          JOHN"
    const { tokens } = tokenize(text)
    expect(tokens[0].type).toBe("CHARACTER")
    expect(tokens[0].characterName).toBe("JOHN")
  })

  it("detects PARENTHETICAL (standalone)", () => {
    const text = screenplay([
      "          JOHN",
      "          (whispering)",
      "          Hello.",
    ])
    const { tokens } = tokenize(text)
    const parenthetical = tokens.find((t) => t.type === "PARENTHETICAL")
    expect(parenthetical).toBeDefined()
  })

  it("detects DIALOGUE after CHARACTER", () => {
    const text = screenplay([
      "          JOHN",
      "     Hello, how are you?",
    ])
    const { tokens } = tokenize(text)
    expect(tokens[0].type).toBe("CHARACTER")
    expect(tokens[1].type).toBe("DIALOGUE")
    expect(tokens[1].content).toBe("Hello, how are you?")
  })

  it("defaults to ACTION", () => {
    const { tokens } = tokenize("Some action description here.")
    expect(tokens[0].type).toBe("ACTION")
  })
})

// ─── Line numbers ────────────────────────────────────────────────────────────

describe("tokenize — line numbers", () => {
  it("preserves 1-based line numbers", () => {
    const text = screenplay([
      "INT. ROOM - DAY",
      "",
      "          JOHN",
      "     Hello.",
    ])
    const { tokens } = tokenize(text)
    expect(tokens[0].line).toBe(1) // SCENE_HEADING
    expect(tokens[1].line).toBe(2) // BLANK
    expect(tokens[2].line).toBe(3) // CHARACTER
    expect(tokens[3].line).toBe(4) // DIALOGUE
  })
})

// ─── Full screenplay ─────────────────────────────────────────────────────────

describe("tokenize — full screenplay", () => {
  it("tokenizes a short screenplay", () => {
    const text = screenplay([
      "INT. LIVING ROOM - DAY",
      "",
      "          JOHN",
      "     Hello, how are you?",
      "",
      "          MARY",
      "     (smiling)",
      "     I'm fine, thanks.",
      "",
      "CUT TO:",
    ])
    const { tokens } = tokenize(text)
    const tt = types(tokens)

    expect(tt).toEqual([
      "SCENE_HEADING",
      "BLANK",
      "CHARACTER",
      "DIALOGUE",
      "BLANK",
      "CHARACTER",
      "PARENTHETICAL",
      "DIALOGUE",
      "BLANK",
      "TRANSITION",
    ])
  })

  it("handles SPEAKER_COLON format screenplay", () => {
    const text = screenplay([
      "JOHN: Hello.",
      "MARY: Hi there.",
      "JOHN: How are you?",
    ])
    const { tokens } = tokenize(text)
    expect(tokens.every((t) => t.type === "SPEAKER_COLON")).toBe(true)
    expect(tokens[0].characterName).toBe("JOHN")
    expect(tokens[1].characterName).toBe("MARY")
    expect(tokens[2].characterName).toBe("JOHN")
  })
})

// ─── Bare character detection ────────────────────────────────────────────────

describe("tokenize — bare characters", () => {
  it("detects bare ALL-CAPS name with indented dialogue next", () => {
    const text = screenplay([
      "JOHN",
      "    Hello there.",
    ])
    const { tokens } = tokenize(text)
    expect(tokens[0].type).toBe("CHARACTER")
    expect(tokens[0].characterName).toBe("JOHN")
    expect(tokens[1].type).toBe("DIALOGUE")
  })

  it("does NOT detect ALL-CAPS as character when no dialogue follows", () => {
    const text = screenplay([
      "CHAPTER ONE",
      "This is a regular paragraph.",
    ])
    const { tokens } = tokenize(text)
    // "CHAPTER ONE" should be ACTION, not CHARACTER (no indented dialogue after)
    expect(tokens[0].type).toBe("ACTION")
  })
})

// ─── groupDialogueBlocks ────────────────────────────────────────────────────

describe("groupDialogueBlocks", () => {
  it("groups CHARACTER tokens with their dialogue", () => {
    const text = screenplay([
      "          JOHN",
      "     Hello.",
      "     How are you?",
      "",
      "          MARY",
      "     Fine, thanks.",
    ])
    const { tokens } = tokenize(text)
    const blocks = groupDialogueBlocks(tokens)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].characterName).toBe("JOHN")
    expect(blocks[0].dialogueLines).toHaveLength(2)
    expect(blocks[1].characterName).toBe("MARY")
    expect(blocks[1].dialogueLines).toHaveLength(1)
  })

  it("groups SPEAKER_COLON tokens", () => {
    const text = screenplay([
      "JOHN: Hello.",
      "MARY: Hi.",
    ])
    const { tokens } = tokenize(text)
    const blocks = groupDialogueBlocks(tokens)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].characterName).toBe("JOHN")
    expect(blocks[0].dialogueLines[0].text).toBe("Hello.")
  })

  it("preserves line numbers in blocks", () => {
    const text = screenplay([
      "",
      "          JOHN",
      "     Hello.",
    ])
    const { tokens } = tokenize(text)
    const blocks = groupDialogueBlocks(tokens)

    expect(blocks[0].characterLine).toBe(2)
    expect(blocks[0].dialogueLines[0].line).toBe(3)
  })

  it("returns empty array for text with no characters", () => {
    const text = "Just some action text.\nAnother line."
    const { tokens } = tokenize(text)
    const blocks = groupDialogueBlocks(tokens)
    expect(blocks).toHaveLength(0)
  })
})
