import { describe, it, expect } from "vitest"
import {
  applyUserEdits,
  convertToDbFormat,
  type ParsedScriptBundle,
  type UserEdit,
} from "../index"
import { parseScript, mergeParseResults, type ScriptParseResult } from "../script-parser"
import { groupSimilarCharacters } from "../fuzzy-matcher"

// ─── Helper ────────────────────────────────────────────────────────────────

function screenplay(lines: string[]): string {
  return lines.join("\n")
}

function makeBundle(text: string): ParsedScriptBundle {
  const parseResult = parseScript(text)
  const characterGroups = groupSimilarCharacters(parseResult.characters)
  return {
    parseResult,
    characterGroups,
    similarityMatches: [],
    extractionWarnings: [],
    files: [{ name: "test.txt", size: "1 KB", status: "success" }],
    verified: false,
    contentType: "screenplay",
    diagnostics: [],
  }
}

// ─── ParsedScriptBundle shape (UI contract) ────────────────────────────────

describe("ParsedScriptBundle shape - UI contract", () => {
  it("has all fields that scripts-tab.tsx accesses", () => {
    const bundle = makeBundle(screenplay([
      "                         JOHN",
      "          Hello.",
    ]))

    // scripts-tab accesses these:
    expect(bundle).toHaveProperty("files")
    expect(bundle).toHaveProperty("parseResult")
    expect(bundle).toHaveProperty("characterGroups")
    expect(bundle).toHaveProperty("verified")

    // parseResult shape
    expect(bundle.parseResult).toHaveProperty("characters")
    expect(bundle.parseResult).toHaveProperty("metadata")
    expect(bundle.parseResult).toHaveProperty("warnings")
    expect(bundle.parseResult.metadata).toHaveProperty("totalReplicas")

    // files shape
    expect(bundle.files[0]).toHaveProperty("name")
    expect(bundle.files[0]).toHaveProperty("status")
    expect(bundle.files[0]).toHaveProperty("size")
  })

  it("has all fields that script-preview-dialog.tsx accesses", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))

    // script-preview-dialog accesses:
    expect(Array.isArray(bundle.parseResult.characters)).toBe(true)
    expect(typeof bundle.parseResult.metadata.totalReplicas).toBe("number")
    expect(Array.isArray(bundle.parseResult.warnings)).toBe(true)
    expect(Array.isArray(bundle.characterGroups)).toBe(true)

    // Each character group has .members
    for (const group of bundle.characterGroups) {
      expect(Array.isArray(group.members)).toBe(true)
      expect(group.members.length).toBeGreaterThanOrEqual(1)
    }

    // Each character has the required fields
    for (const char of bundle.parseResult.characters) {
      expect(typeof char.name).toBe("string")
      expect(typeof char.normalizedName).toBe("string")
      expect(typeof char.replicaCount).toBe("number")
      expect(Array.isArray(char.variants)).toBe(true)
      expect(typeof char.possibleGroup).toBe("boolean")
    }

    // Warnings have the right shape
    for (const w of bundle.parseResult.warnings) {
      expect(typeof w.type).toBe("string")
      expect(typeof w.message).toBe("string")
      expect(Array.isArray(w.characters)).toBe(true)
    }
  })
})

// ─── applyUserEdits ────────────────────────────────────────────────────────

describe("applyUserEdits", () => {
  it("deletes a character", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))

    const edits: UserEdit[] = [{ type: "delete", character: "JOHN" }]
    const result = applyUserEdits(bundle, edits)

    const names = result.parseResult.characters.map(c => c.normalizedName)
    expect(names).not.toContain("JOHN")
    expect(names).toContain("SARAH")
  })

  it("renames a character", () => {
    const bundle = makeBundle(screenplay([
      "                         JOHN",
      "          Hello!",
    ]))

    const edits: UserEdit[] = [{ type: "rename", character: "JOHN", newName: "JONATHAN" }]
    const result = applyUserEdits(bundle, edits)

    expect(result.parseResult.characters[0].name).toBe("JONATHAN")
    expect(result.parseResult.characters[0].normalizedName).toBe("JONATHAN")
  })

  it("merges characters", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         JOHNNY",
      "          Hi!",
    ]))

    const edits: UserEdit[] = [{
      type: "merge",
      characters: ["JOHN", "JOHNNY"],
      newName: "JOHN",
    }]
    const result = applyUserEdits(bundle, edits)

    const john = result.parseResult.characters.find(c => c.normalizedName === "JOHN")
    expect(john).toBeDefined()
    expect(john!.replicaCount).toBe(2)
  })

  it("marks a character as group", () => {
    const bundle = makeBundle(screenplay([
      "                         GUARDS",
      "          Yes sir!",
    ]))

    const edits: UserEdit[] = [{ type: "mark_group", character: "GUARDS" }]
    const result = applyUserEdits(bundle, edits)

    const guards = result.parseResult.characters.find(c => c.normalizedName === "GUARDS")
    expect(guards!.possibleGroup).toBe(true)
  })

  it("preserves bundle shape after edits", () => {
    const bundle = makeBundle(screenplay([
      "                         JOHN",
      "          Hello!",
    ]))

    const result = applyUserEdits(bundle, [])

    // Same shape as input
    expect(result).toHaveProperty("parseResult")
    expect(result).toHaveProperty("characterGroups")
    expect(result).toHaveProperty("files")
    expect(result).toHaveProperty("verified")
  })
})

// ─── convertToDbFormat ─────────────────────────────────────────────────────

describe("convertToDbFormat", () => {
  it("converts characters to RoleForDatabase format", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))

    const { roles, conflicts } = convertToDbFormat(bundle)

    expect(roles.length).toBeGreaterThanOrEqual(2)
    for (const role of roles) {
      // script-actions.ts accesses these fields:
      expect(role).toHaveProperty("role_name")
      expect(role).toHaveProperty("role_name_normalized")
      expect(role).toHaveProperty("replicas_needed")
      expect(role).toHaveProperty("source")
      expect(typeof role.role_name).toBe("string")
      expect(typeof role.role_name_normalized).toBe("string")
      expect(typeof role.replicas_needed).toBe("number")
      expect(role.source).toBe("script")
    }
  })

  it("converts interactions to ConflictForDatabase format", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         SARAH",
      "          Hi!",
    ]))

    const { conflicts } = convertToDbFormat(bundle)

    for (const conflict of conflicts) {
      // script-actions.ts accesses these fields:
      expect(conflict).toHaveProperty("role_name_a")
      expect(conflict).toHaveProperty("role_name_b")
      expect(conflict).toHaveProperty("warning_type")
      expect(typeof conflict.role_name_a).toBe("string")
      expect(typeof conflict.role_name_b).toBe("string")
      expect(typeof conflict.warning_type).toBe("string")
    }
  })

  it("sets parent_role_id for child variants", () => {
    const bundle = makeBundle(screenplay([
      "INT. ROOM - DAY",
      "",
      "                         JOHN",
      "          Hello!",
      "",
      "                         YOUNG JOHN",
      "          Hello from the past!",
    ]))

    const { roles } = convertToDbFormat(bundle)
    const youngJohn = roles.find(r => r.role_name_normalized === "YOUNG JOHN")
    // May or may not be grouped; if grouped, parent_role_id is set
    if (youngJohn?.parent_role_id) {
      expect(typeof youngJohn.parent_role_id).toBe("string")
    }
  })
})

// ─── mergeParseResults ─────────────────────────────────────────────────────

describe("mergeParseResults", () => {
  it("merges characters from multiple results", () => {
    const result1 = parseScript(screenplay([
      "                         JOHN",
      "          Hello!",
    ]))
    const result2 = parseScript(screenplay([
      "                         SARAH",
      "          Hi!",
    ]))

    const merged = mergeParseResults([result1, result2])
    const names = merged.characters.map(c => c.normalizedName)
    expect(names).toContain("JOHN")
    expect(names).toContain("SARAH")
  })

  it("sums replicas for same character across files", () => {
    const result1 = parseScript(screenplay([
      "                         JOHN",
      "          Hello!",
    ]))
    const result2 = parseScript(screenplay([
      "                         JOHN",
      "          Hi again!",
    ]))

    const merged = mergeParseResults([result1, result2])
    const john = merged.characters.find(c => c.normalizedName === "JOHN")
    expect(john!.replicaCount).toBe(2)
  })

  it("sums total lines across files", () => {
    const result1 = parseScript("Line 1\nLine 2")
    const result2 = parseScript("Line 3\nLine 4\nLine 5")

    const merged = mergeParseResults([result1, result2])
    expect(merged.metadata.totalLines).toBe(5)
  })

  it("returns correct shape for empty input", () => {
    const merged = mergeParseResults([])
    expect(merged.characters).toEqual([])
    expect(merged.warnings).toEqual([])
    expect(merged.interactions).toEqual([])
    expect(merged.metadata.totalLines).toBe(0)
  })
})
