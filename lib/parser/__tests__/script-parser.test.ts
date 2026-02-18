import { describe, it, expect } from "vitest"
import { parseScript, normalizeCharacterName, type ScriptParseResult } from "../script-parser"

// ─── Helper: build a screenplay snippet ────────────────────────────────────

function screenplay(lines: string[]): string {
  return lines.join("\n")
}

// ─── normalizeCharacterName ────────────────────────────────────────────────

describe("normalizeCharacterName", () => {
  it("uppercases the name", () => {
    expect(normalizeCharacterName("John")).toBe("JOHN")
  })

  it("strips V.O. parenthetical", () => {
    expect(normalizeCharacterName("JOHN (V.O.)")).toBe("JOHN")
  })

  it("strips O.S. parenthetical", () => {
    expect(normalizeCharacterName("SARAH (O.S.)")).toBe("SARAH")
  })

  it("strips CONT'D parenthetical", () => {
    expect(normalizeCharacterName("JOHN (CONT'D)")).toBe("JOHN")
  })

  it("strips CONTINUING parenthetical", () => {
    expect(normalizeCharacterName("SARAH (CONTINUING)")).toBe("SARAH")
  })

  it("strips multiple parentheticals", () => {
    expect(normalizeCharacterName("JOHN (V.O.) (CONT'D)")).toBe("JOHN")
  })

  it("preserves trailing numbers (GUARD 1 != GUARD 2)", () => {
    expect(normalizeCharacterName("GUARD 1")).toBe("GUARD 1")
    expect(normalizeCharacterName("GUARD 2")).toBe("GUARD 2")
    expect(normalizeCharacterName("GUARD 1")).not.toBe(
      normalizeCharacterName("GUARD 2")
    )
  })

  it("strips hash-numbered characters", () => {
    expect(normalizeCharacterName("CHARACTER #1")).toBe("CHARACTER")
  })

  it("strips generic trailing parentheticals", () => {
    expect(normalizeCharacterName("JOHN (WHISPERS)")).toBe("JOHN")
  })

  it("handles empty / whitespace-only input", () => {
    expect(normalizeCharacterName("")).toBe("")
    expect(normalizeCharacterName("   ")).toBe("")
  })
})

// ─── parseScript: basic extraction ─────────────────────────────────────────

describe("parseScript - basic character extraction", () => {
  it("extracts a standard character followed by dialogue", () => {
    const result = parseScript(screenplay([
      "                         JOHN",
      "          Hello there, how are you?",
    ]))
    expect(result.characters.length).toBeGreaterThanOrEqual(1)
    expect(result.characters.some(c => c.normalizedName === "JOHN")).toBe(true)
  })

  it("extracts multiple characters in the same scene", () => {
    const result = parseScript(screenplay([
      "INT. LIVING ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello there!",
      "",
      "                         SARAH",
      "          Hi John!",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).toContain("JOHN")
    expect(names).toContain("SARAH")
  })

  it("counts replicas correctly", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Line one.",
      "",
      "                         SARAH",
      "          Response.",
      "",
      "                         JOHN",
      "          Line two.",
      "",
      "                         JOHN",
      "          Line three.",
    ]))
    const john = result.characters.find(c => c.normalizedName === "JOHN")
    expect(john).toBeDefined()
    expect(john!.replicaCount).toBe(3)

    const sarah = result.characters.find(c => c.normalizedName === "SARAH")
    expect(sarah!.replicaCount).toBe(1)
  })

  it("records firstAppearance line number", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello.",
    ]))
    const john = result.characters.find(c => c.normalizedName === "JOHN")
    expect(john!.firstAppearance).toBe(3)
  })

  it("collects variant spellings", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello.",
      "",
      "                         JOHN (V.O.)",
      "          Narrating.",
    ]))
    const john = result.characters.find(c => c.normalizedName === "JOHN")
    expect(john!.variants.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── parseScript: filtering false positives ────────────────────────────────

describe("parseScript - filtering screenplay elements", () => {
  it("does NOT extract scene headings as characters", () => {
    const result = parseScript(screenplay([
      "INT. KITCHEN - NIGHT",
      "",
      "                         JOHN",
      "          Hello.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("INT. KITCHEN - NIGHT")
    expect(names).not.toContain("INT")
  })

  it("does NOT extract transitions as characters", () => {
    const result = parseScript(screenplay([
      "                         JOHN",
      "          Hello.",
      "",
      "CUT TO:",
      "",
      "FADE OUT.",
      "",
      "DISSOLVE TO:",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("CUT TO")
    expect(names).not.toContain("FADE OUT")
    expect(names).not.toContain("DISSOLVE TO")
  })

  it("does NOT extract camera directions as characters", () => {
    const result = parseScript(screenplay([
      "CLOSE ON",
      "WIDE SHOT",
      "ANGLE ON",
      "                         JOHN",
      "          Hello.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("CLOSE ON")
    expect(names).not.toContain("WIDE SHOT")
    expect(names).not.toContain("ANGLE ON")
  })

  it("does NOT extract MONTAGE, FLASHBACK etc. as characters", () => {
    const result = parseScript(screenplay([
      "MONTAGE",
      "FLASHBACK",
      "INTERCUT",
      "                         JOHN",
      "          Hello.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("MONTAGE")
    expect(names).not.toContain("FLASHBACK")
    expect(names).not.toContain("INTERCUT")
  })

  it("does NOT extract (MORE) or (CONT'D) as characters", () => {
    const result = parseScript(screenplay([
      "                         JOHN",
      "          Hello there, this is a long line",
      "          (MORE)",
      "",
      "                         JOHN (CONT'D)",
      "          that continues here.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("MORE")
    expect(names).not.toContain("CONT'D")
  })

  it("does NOT extract parenthetical stage directions as characters", () => {
    const result = parseScript(screenplay([
      "                         JOHN",
      "          (sighing)",
      "          Hello there.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).not.toContain("(SIGHING)")
    expect(names).not.toContain("SIGHING")
  })
})

// ─── parseScript: parenthetical handling ───────────────────────────────────

describe("parseScript - parenthetical extensions", () => {
  it("normalizes V.O. character to base name", () => {
    const result = parseScript(screenplay([
      "                         JOHN (V.O.)",
      "          I remember it well.",
    ]))
    expect(result.characters.some(c => c.normalizedName === "JOHN")).toBe(true)
  })

  it("normalizes O.S. character to base name", () => {
    const result = parseScript(screenplay([
      "                         SARAH (O.S.)",
      "          Over here!",
    ]))
    expect(result.characters.some(c => c.normalizedName === "SARAH")).toBe(true)
  })

  it("normalizes ON PHONE character", () => {
    const result = parseScript(screenplay([
      "                         JOHN (ON PHONE)",
      "          Yes, I understand.",
    ]))
    expect(result.characters.some(c => c.normalizedName === "JOHN")).toBe(true)
  })
})

// ─── parseScript: variant detection ────────────────────────────────────────

describe("parseScript - character variants", () => {
  it("detects YOUNG X as variant of X", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello.",
      "",
      "                         YOUNG JOHN",
      "          Hi there.",
    ]))
    const youngJohn = result.characters.find(c => c.normalizedName === "YOUNG JOHN")
    expect(youngJohn).toBeDefined()
    expect(youngJohn!.parentName).toBe("JOHN")
  })

  it("detects VOICE OF X as variant of X", () => {
    const result = parseScript(screenplay([
      "                         VOICE OF JOHN",
      "          I was there that night.",
    ]))
    const voiceOfJohn = result.characters.find(c =>
      c.normalizedName === "VOICE OF JOHN"
    )
    expect(voiceOfJohn).toBeDefined()
    expect(voiceOfJohn!.parentName).toBe("JOHN")
  })
})

// ─── parseScript: group detection ──────────────────────────────────────────

describe("parseScript - group characters", () => {
  it("marks CROWD as a group", () => {
    const result = parseScript(screenplay([
      "                         CROWD",
      "          Hooray!",
    ]))
    const crowd = result.characters.find(c => c.normalizedName === "CROWD")
    expect(crowd).toBeDefined()
    expect(crowd!.possibleGroup).toBe(true)
  })

  it("marks SOLDIERS as a group", () => {
    const result = parseScript(screenplay([
      "                         SOLDIERS",
      "          Yes, sir!",
    ]))
    const soldiers = result.characters.find(c => c.normalizedName === "SOLDIERS")
    expect(soldiers).toBeDefined()
    expect(soldiers!.possibleGroup).toBe(true)
  })
})

// ─── parseScript: combined roles ───────────────────────────────────────────

describe("parseScript - combined roles", () => {
  it("splits JOHN / MARY into two separate characters", () => {
    const result = parseScript(screenplay([
      "                         JOHN / MARY",
      "          We agree!",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).toContain("JOHN")
    expect(names).toContain("MARY")
  })
})

// ─── parseScript: numbered characters ──────────────────────────────────────

describe("parseScript - numbered characters", () => {
  it("keeps GUARD 1 and GUARD 2 as separate characters", () => {
    const result = parseScript(screenplay([
      "INT. GATE - NIGHT",
      "",
      "                         GUARD 1",
      "          Who goes there?",
      "",
      "                         GUARD 2",
      "          It's the king.",
    ]))
    const names = result.characters.map(c => c.normalizedName)
    expect(names).toContain("GUARD 1")
    expect(names).toContain("GUARD 2")
  })
})

// ─── parseScript: interactions ─────────────────────────────────────────────

describe("parseScript - interactions", () => {
  it("tracks interactions between characters in the same scene", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))
    expect(result.interactions.length).toBeGreaterThanOrEqual(1)
    const interaction = result.interactions[0]
    const pair = [interaction.characterA, interaction.characterB].sort()
    expect(pair).toEqual(["JOHN", "SARAH"])
  })

  it("resets interactions on new scene", () => {
    const result = parseScript(screenplay([
      "INT. ROOM A - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "INT. ROOM B - NIGHT",
      "",
      "                         SARAH",
      "          Hi!",
    ]))
    // JOHN and SARAH are in different scenes, no interaction
    const hasCrossSceneInteraction = result.interactions.some(
      i =>
        (i.characterA === "JOHN" && i.characterB === "SARAH") ||
        (i.characterA === "SARAH" && i.characterB === "JOHN")
    )
    expect(hasCrossSceneInteraction).toBe(false)
  })
})

// ─── parseScript: metadata ─────────────────────────────────────────────────

describe("parseScript - metadata", () => {
  it("reports total lines", () => {
    const text = screenplay(["Line 1", "Line 2", "Line 3"])
    const result = parseScript(text)
    expect(result.metadata.totalLines).toBe(3)
  })

  it("reports total replicas", () => {
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello.",
      "",
      "                         SARAH",
      "          Hi.",
    ]))
    expect(result.metadata.totalReplicas).toBe(2)
  })

  it("reports parseTime >= 0", () => {
    const result = parseScript("hello")
    expect(result.metadata.parseTime).toBeGreaterThanOrEqual(0)
  })
})

// ─── parseScript: result shape matches UI expectations ─────────────────────

describe("parseScript - result shape (UI contract)", () => {
  it("has all required top-level fields", () => {
    const result = parseScript("")
    expect(result).toHaveProperty("characters")
    expect(result).toHaveProperty("warnings")
    expect(result).toHaveProperty("interactions")
    expect(result).toHaveProperty("metadata")
    expect(Array.isArray(result.characters)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(Array.isArray(result.interactions)).toBe(true)
  })

  it("characters have all fields the UI accesses", () => {
    const result = parseScript(screenplay([
      "                         JOHN",
      "          Hello.",
    ]))
    const char = result.characters[0]
    expect(char).toHaveProperty("name")
    expect(char).toHaveProperty("normalizedName")
    expect(char).toHaveProperty("replicaCount")
    expect(char).toHaveProperty("variants")
    expect(char).toHaveProperty("possibleGroup")
    // parentName is optional but must be defined as a key
    expect("parentName" in char).toBe(true)
    expect(typeof char.name).toBe("string")
    expect(typeof char.normalizedName).toBe("string")
    expect(typeof char.replicaCount).toBe("number")
    expect(Array.isArray(char.variants)).toBe(true)
    expect(typeof char.possibleGroup).toBe("boolean")
  })

  it("warnings have type, message, and characters fields", () => {
    const result = parseScript(screenplay([
      "                         CROWD",
      "          Hooray!",
    ]))
    if (result.warnings.length > 0) {
      const warning = result.warnings[0]
      expect(warning).toHaveProperty("type")
      expect(warning).toHaveProperty("message")
      expect(warning).toHaveProperty("characters")
      expect(typeof warning.type).toBe("string")
      expect(typeof warning.message).toBe("string")
      expect(Array.isArray(warning.characters)).toBe(true)
    }
  })

  it("metadata has totalReplicas (used by scripts-tab)", () => {
    const result = parseScript("")
    expect(typeof result.metadata.totalReplicas).toBe("number")
  })

  it("warning types are filterable by UI categories", () => {
    // The UI filters on these exact strings
    const validTypes = [
      "possible_duplicate",
      "possible_group",
      "ambiguous_name",
      "interaction",
      "combined_role",
    ]
    const result = parseScript(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         CROWD",
      "          Hooray!",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))
    for (const w of result.warnings) {
      expect(validTypes).toContain(w.type)
    }
  })
})
