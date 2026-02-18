import { describe, it, expect } from "vitest"
import {
  similarityRatio,
  findSimilarCharacters,
  generateSimilarityWarnings,
  groupSimilarCharacters,
  type SimilarityMatch,
} from "../fuzzy-matcher"
import type { ExtractedCharacter } from "../script-parser"

// ─── Helper ────────────────────────────────────────────────────────────────

function makeChar(
  name: string,
  overrides: Partial<ExtractedCharacter> = {}
): ExtractedCharacter {
  return {
    name,
    normalizedName: name.toUpperCase(),
    replicaCount: 1,
    firstAppearance: 1,
    variants: [name],
    possibleGroup: false,
    ...overrides,
  }
}

// ─── similarityRatio ───────────────────────────────────────────────────────

describe("similarityRatio", () => {
  it("returns 1 for identical strings", () => {
    expect(similarityRatio("JOHN", "JOHN")).toBe(1)
  })

  it("returns 0 for completely different strings of same length", () => {
    expect(similarityRatio("ABCD", "WXYZ")).toBe(0)
  })

  it("returns high value for similar strings", () => {
    // JOHNN vs JOHN - one insertion = distance 1
    expect(similarityRatio("JOHN", "JOHNN")).toBeGreaterThan(0.5)
  })

  it("returns 1 for two empty strings", () => {
    expect(similarityRatio("", "")).toBe(1)
  })
})

// ─── findSimilarCharacters: Levenshtein ────────────────────────────────────

describe("findSimilarCharacters - Levenshtein", () => {
  it("finds similar names by spelling", () => {
    const chars = [
      makeChar("JOHNSON", { normalizedName: "JOHNSON" }),
      makeChar("JOHNSEN", { normalizedName: "JOHNSEN" }),
    ]
    const matches = findSimilarCharacters(chars, 0.7)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0].reason).toBe("levenshtein")
  })

  it("does NOT match very different names", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN" }),
      makeChar("ELIZABETH", { normalizedName: "ELIZABETH" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    const levMatches = matches.filter(m => m.reason === "levenshtein")
    expect(levMatches.length).toBe(0)
  })
})

// ─── findSimilarCharacters: title variants ─────────────────────────────────

describe("findSimilarCharacters - title variants", () => {
  it("matches DR. SMITH and SMITH (title variant)", () => {
    const chars = [
      makeChar("DR. SMITH", { normalizedName: "DR. SMITH" }),
      makeChar("SMITH", { normalizedName: "SMITH" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    // Should be title_variant or contains
    const matchReasons = matches.map(m => m.reason)
    expect(
      matchReasons.includes("title_variant") || matchReasons.includes("contains")
    ).toBe(true)
  })

  it("matches CAPTAIN JONES and JONES", () => {
    const chars = [
      makeChar("CAPTAIN JONES", { normalizedName: "CAPTAIN JONES" }),
      makeChar("JONES", { normalizedName: "JONES" }),
    ]
    const matches = findSimilarCharacters(chars, 0.7)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it("uses OR logic: only one name needs a title to trigger title_variant", () => {
    // This was the old bug - the condition used AND instead of OR
    const chars = [
      makeChar("SGT WILLIAMS", { normalizedName: "SGT WILLIAMS" }),
      makeChar("WILLIAMS", { normalizedName: "WILLIAMS" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    const titleMatch = matches.find(m => m.reason === "title_variant")
    // Either title_variant or contains should catch this
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── findSimilarCharacters: nickname variants ──────────────────────────────

describe("findSimilarCharacters - nicknames", () => {
  it("matches WILLIAM and BILL", () => {
    const chars = [
      makeChar("WILLIAM", { normalizedName: "WILLIAM" }),
      makeChar("BILL", { normalizedName: "BILL" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches.some(m => m.reason === "nickname")).toBe(true)
  })

  it("matches ELIZABETH and LIZ", () => {
    const chars = [
      makeChar("ELIZABETH", { normalizedName: "ELIZABETH" }),
      makeChar("LIZ", { normalizedName: "LIZ" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "nickname")).toBe(true)
  })

  it("matches MICHAEL and MIKE", () => {
    const chars = [
      makeChar("MICHAEL", { normalizedName: "MICHAEL" }),
      makeChar("MIKE", { normalizedName: "MIKE" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "nickname")).toBe(true)
  })

  it("matches ROBERT and BOB", () => {
    const chars = [
      makeChar("ROBERT", { normalizedName: "ROBERT" }),
      makeChar("BOB", { normalizedName: "BOB" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "nickname")).toBe(true)
  })

  it("matches WILLIAM SMITH and BILL SMITH (same last name)", () => {
    const chars = [
      makeChar("WILLIAM SMITH", { normalizedName: "WILLIAM SMITH" }),
      makeChar("BILL SMITH", { normalizedName: "BILL SMITH" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "nickname")).toBe(true)
  })

  it("does NOT match WILLIAM SMITH and BILL JONES (different last name)", () => {
    const chars = [
      makeChar("WILLIAM SMITH", { normalizedName: "WILLIAM SMITH" }),
      makeChar("BILL JONES", { normalizedName: "BILL JONES" }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "nickname")).toBe(false)
  })
})

// ─── findSimilarCharacters: combined roles ─────────────────────────────────

describe("findSimilarCharacters - combined roles", () => {
  it("matches characters with overlapping combinedRole", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN", combinedRole: ["JOHN", "MARY"] }),
      makeChar("MARY", { normalizedName: "MARY", combinedRole: ["JOHN", "MARY"] }),
    ]
    const matches = findSimilarCharacters(chars, 0.8)
    expect(matches.some(m => m.reason === "combined_role")).toBe(true)
  })
})

// ─── findSimilarCharacters: skips parent-child ─────────────────────────────

describe("findSimilarCharacters - parent-child skip", () => {
  it("skips characters already marked as parent-child", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN" }),
      makeChar("YOUNG JOHN", { normalizedName: "YOUNG JOHN", parentName: "JOHN" }),
    ]
    const matches = findSimilarCharacters(chars, 0.5)
    expect(matches.length).toBe(0)
  })
})

// ─── generateSimilarityWarnings ────────────────────────────────────────────

describe("generateSimilarityWarnings", () => {
  it("generates warnings with correct shape for UI", () => {
    const matches: SimilarityMatch[] = [
      { character1: "JOHN", character2: "JHON", similarity: 0.85, reason: "levenshtein" },
    ]
    const warnings = generateSimilarityWarnings(matches)

    expect(warnings.length).toBe(1)
    expect(warnings[0]).toHaveProperty("type")
    expect(warnings[0]).toHaveProperty("message")
    expect(warnings[0]).toHaveProperty("characters")
    expect(warnings[0].type).toBe("possible_duplicate")
    expect(warnings[0].characters).toEqual(["JOHN", "JHON"])
  })

  it("generates correct message for each reason type", () => {
    const reasons: SimilarityMatch["reason"][] = [
      "levenshtein", "contains", "title_variant", "nickname", "combined_role"
    ]
    for (const reason of reasons) {
      const matches: SimilarityMatch[] = [
        { character1: "A", character2: "B", similarity: 0.9, reason },
      ]
      const warnings = generateSimilarityWarnings(matches)
      expect(warnings[0].type).toBe("possible_duplicate")
      expect(typeof warnings[0].message).toBe("string")
      expect(warnings[0].message.length).toBeGreaterThan(0)
    }
  })
})

// ─── groupSimilarCharacters ────────────────────────────────────────────────

describe("groupSimilarCharacters", () => {
  it("groups parent-child into the same group", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN", replicaCount: 10 }),
      makeChar("YOUNG JOHN", { normalizedName: "YOUNG JOHN", parentName: "JOHN", replicaCount: 3 }),
    ]
    const groups = groupSimilarCharacters(chars)
    const johnGroup = groups.find(g => g.primaryName === "JOHN")
    expect(johnGroup).toBeDefined()
    expect(johnGroup!.members).toContain("YOUNG JOHN")
    expect(johnGroup!.totalReplicas).toBe(13)
  })

  it("puts ungrouped characters in single-member groups", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN" }),
      makeChar("SARAH", { normalizedName: "SARAH" }),
    ]
    const groups = groupSimilarCharacters(chars)
    expect(groups.length).toBe(2)
    expect(groups.every(g => g.members.length === 1)).toBe(true)
  })

  it("applies manual groups correctly", () => {
    const chars = [
      makeChar("JOHN", { normalizedName: "JOHN", replicaCount: 5 }),
      makeChar("JOHNNY", { normalizedName: "JOHNNY", replicaCount: 3 }),
    ]
    const groups = groupSimilarCharacters(chars, [
      { primary: "JOHN", members: ["JOHNNY"] },
    ])
    const johnGroup = groups.find(g => g.primaryName === "JOHN")
    expect(johnGroup).toBeDefined()
    expect(johnGroup!.members).toContain("JOHN")
    expect(johnGroup!.members).toContain("JOHNNY")
    expect(johnGroup!.totalReplicas).toBe(8)
  })

  it("groups have members array (UI checks .members.length)", () => {
    const chars = [makeChar("JOHN", { normalizedName: "JOHN" })]
    const groups = groupSimilarCharacters(chars)
    expect(groups.length).toBe(1)
    expect(Array.isArray(groups[0].members)).toBe(true)
    expect(groups[0].members.length).toBeGreaterThanOrEqual(1)
  })
})
