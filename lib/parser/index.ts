/**
 * Script Parser Module
 *
 * Main entry point for the script parsing functionality.
 * Combines text extraction, character parsing, and fuzzy matching.
 *
 * Pipeline architecture:
 * 1. Text extraction (from file format to plain text)
 * 2. Regex-based character parsing (primary, always runs)
 * 3. Fuzzy matching & grouping (deduplication)
 * 4. [Optional] Verification step via webhook (AI-based, pluggable)
 *
 * The verification step is designed as a hook point for a future webhook
 * that can send the parsed results to an AI service for validation.
 * When no verifier is configured, the pipeline runs regex-only.
 */

export * from "./script-parser"
export * from "./fuzzy-matcher"
export * from "./text-extractor"

import { extractText, getFileInfo } from "./text-extractor"
import { parseScript, mergeParseResults, type ScriptParseResult, type ExtractedCharacter } from "./script-parser"
import { findSimilarCharacters, generateSimilarityWarnings, groupSimilarCharacters, type CharacterGroup } from "./fuzzy-matcher"

// ─── Pipeline Types ─────────────────────────────────────────────────────────

export interface ParsedScriptBundle {
  /** Results from parsing all files */
  parseResult: ScriptParseResult

  /** Characters grouped by similarity/relationship */
  characterGroups: CharacterGroup[]

  /** Similar character matches for user review */
  similarityMatches: { character1: string; character2: string; similarity: number; reason: string }[]

  /** Extraction warnings (format issues, etc.) */
  extractionWarnings: string[]

  /** Files that were parsed */
  files: { name: string; size: string; status: "success" | "error"; error?: string }[]

  /** Whether the result was verified by an external service */
  verified: boolean

  /** Verification metadata (populated when webhook verifier is used) */
  verification?: VerificationResult
}

// ─── Verification Hook Interface ────────────────────────────────────────────

/**
 * Result returned by a verification step.
 * The verifier can suggest corrections to the regex-parsed results.
 */
export interface VerificationResult {
  /** Whether verification was successful */
  success: boolean

  /** Source of verification (e.g., "ai-webhook", "manual") */
  source: string

  /** Timestamp of verification */
  timestamp: string

  /** Characters that the verifier suggests adding (missed by regex) */
  addedCharacters?: VerificationCharacterSuggestion[]

  /** Characters that the verifier suggests removing (false positives from regex) */
  removedCharacters?: string[]

  /** Characters that the verifier suggests renaming */
  renamedCharacters?: { from: string; to: string }[]

  /** Characters that should be merged (duplicates the regex missed) */
  mergedCharacters?: { primary: string; duplicates: string[] }[]

  /** Additional warnings from the verifier */
  warnings?: string[]

  /** Raw response from the verifier (for debugging) */
  rawResponse?: unknown
}

export interface VerificationCharacterSuggestion {
  name: string
  normalizedName: string
  estimatedReplicas: number
  reason: string
}

/**
 * Interface for a verification step in the parsing pipeline.
 * Implement this to add AI-based verification via webhook or other means.
 *
 * Usage:
 *   const verifier: ParseVerifier = {
 *     verify: async (result, rawText) => {
 *       const response = await fetch('https://your-webhook.com/verify', {
 *         method: 'POST',
 *         body: JSON.stringify({ characters: result.characters, text: rawText })
 *       })
 *       return await response.json()
 *     }
 *   }
 *   const result = await parseScriptFiles(files, { verifier })
 */
export interface ParseVerifier {
  /**
   * Verify and potentially correct the regex-parsed results.
   * @param parseResult - The result from the regex parser
   * @param rawText - The raw extracted text (for the verifier to re-analyze)
   * @returns Verification result with suggested corrections
   */
  verify(
    parseResult: ScriptParseResult,
    rawText: string
  ): Promise<VerificationResult>
}

/**
 * Options for the parsing pipeline
 */
export interface ParseOptions {
  /** Optional verifier to validate regex results (e.g., AI webhook) */
  verifier?: ParseVerifier

  /** Similarity threshold for fuzzy matching (0-1, default 0.75) */
  similarityThreshold?: number

  /** Whether to auto-apply verification corrections (default: false, just suggest) */
  autoApplyVerification?: boolean
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Parse multiple script files and return combined results.
 * This is the main function to call from the UI.
 *
 * Pipeline steps:
 * 1. Extract text from each file
 * 2. Parse characters using regex patterns
 * 3. Merge results from multiple files
 * 4. Run fuzzy matching for duplicate detection
 * 5. [Optional] Run verification webhook
 * 6. Apply verification corrections (if auto-apply is enabled)
 */
export async function parseScriptFiles(
  files: File[],
  options: ParseOptions = {}
): Promise<ParsedScriptBundle> {
  const {
    verifier,
    similarityThreshold = 0.75,
    autoApplyVerification = false
  } = options

  const results: ScriptParseResult[] = []
  const extractionWarnings: string[] = []
  const fileStatuses: ParsedScriptBundle["files"] = []
  const rawTexts: string[] = []

  // Step 1 & 2: Extract text and parse each file
  for (const file of files) {
    const fileInfo = getFileInfo(file)

    if (!fileInfo.supported) {
      fileStatuses.push({
        name: file.name,
        size: fileInfo.size,
        status: "error",
        error: `פורמט קובץ לא נתמך: .${fileInfo.extension}`
      })
      continue
    }

    try {
      const { text, warnings } = await extractText(file)
      extractionWarnings.push(...warnings.map(w => `${file.name}: ${w}`))
      rawTexts.push(text)

      const parseResult = parseScript(text)
      results.push(parseResult)

      fileStatuses.push({
        name: file.name,
        size: fileInfo.size,
        status: "success"
      })
    } catch (error) {
      fileStatuses.push({
        name: file.name,
        size: fileInfo.size,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Step 3: Merge all results
  let mergedResult = results.length > 0
    ? mergeParseResults(results)
    : {
        characters: [],
        warnings: [],
        interactions: [],
        metadata: { totalLines: 0, totalReplicas: 0, parseTime: 0 }
      }

  // Step 4: Find similar characters using fuzzy matching
  const similarityMatches = findSimilarCharacters(mergedResult.characters, similarityThreshold)

  // Add similarity warnings to the result
  const similarityWarnings = generateSimilarityWarnings(similarityMatches)
  mergedResult.warnings.push(...similarityWarnings)

  // Group characters
  const characterGroups = groupSimilarCharacters(mergedResult.characters)

  // Step 5: Optional verification
  let verified = false
  let verification: VerificationResult | undefined

  if (verifier && mergedResult.characters.length > 0) {
    try {
      const combinedRawText = rawTexts.join("\n\n--- FILE BREAK ---\n\n")
      verification = await verifier.verify(mergedResult, combinedRawText)
      verified = verification.success

      // Step 6: Auto-apply corrections if enabled
      if (autoApplyVerification && verification.success) {
        mergedResult = applyVerificationCorrections(mergedResult, verification)
      }
    } catch (error) {
      console.error("Verification step failed:", error)
      extractionWarnings.push(
        `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  return {
    parseResult: mergedResult,
    characterGroups,
    similarityMatches,
    extractionWarnings,
    files: fileStatuses,
    verified,
    verification
  }
}

/**
 * Apply verification corrections to the parse result.
 * This merges the AI verifier's suggestions into the regex-parsed result.
 */
function applyVerificationCorrections(
  result: ScriptParseResult,
  verification: VerificationResult
): ScriptParseResult {
  let characters = [...result.characters]
  const warnings = [...result.warnings]

  // Remove false positives
  if (verification.removedCharacters) {
    characters = characters.filter(
      c => !verification.removedCharacters!.includes(c.normalizedName)
    )
  }

  // Rename characters
  if (verification.renamedCharacters) {
    for (const rename of verification.renamedCharacters) {
      const char = characters.find(c => c.normalizedName === rename.from)
      if (char) {
        char.name = rename.to
        char.normalizedName = rename.to.toUpperCase()
      }
    }
  }

  // Add missed characters
  if (verification.addedCharacters) {
    for (const suggestion of verification.addedCharacters) {
      if (!characters.some(c => c.normalizedName === suggestion.normalizedName)) {
        characters.push({
          name: suggestion.name,
          normalizedName: suggestion.normalizedName,
          replicaCount: suggestion.estimatedReplicas,
          firstAppearance: 0,
          variants: [suggestion.name],
          possibleGroup: false,
        })
      }
    }
  }

  // Merge duplicates
  if (verification.mergedCharacters) {
    for (const merge of verification.mergedCharacters) {
      const primary = characters.find(c => c.normalizedName === merge.primary)
      if (!primary) continue

      for (const dup of merge.duplicates) {
        const dupChar = characters.find(c => c.normalizedName === dup)
        if (dupChar) {
          primary.replicaCount += dupChar.replicaCount
          for (const v of dupChar.variants) {
            if (!primary.variants.includes(v)) primary.variants.push(v)
          }
          characters = characters.filter(c => c.normalizedName !== dup)
        }
      }
    }
  }

  // Add verification warnings
  if (verification.warnings) {
    for (const w of verification.warnings) {
      warnings.push({
        type: "ambiguous_name",
        message: `[Verification] ${w}`,
        characters: []
      })
    }
  }

  characters.sort((a, b) => b.replicaCount - a.replicaCount)

  return { ...result, characters, warnings }
}

// ─── User Edits ─────────────────────────────────────────────────────────────

/**
 * Apply user edits to the parsed result
 */
export interface UserEdit {
  type: "merge" | "split" | "rename" | "delete" | "mark_group"
  /** For merge: the characters to merge */
  characters?: string[]
  /** For merge/rename: the new primary name */
  newName?: string
  /** For split: the character to split */
  character?: string
}

export function applyUserEdits(
  result: ParsedScriptBundle,
  edits: UserEdit[]
): ParsedScriptBundle {
  let characters = [...result.parseResult.characters]
  let groups = [...result.characterGroups]

  for (const edit of edits) {
    switch (edit.type) {
      case "merge":
        if (edit.characters && edit.characters.length >= 2 && edit.newName) {
          // Find all characters to merge
          const toMerge = characters.filter(c =>
            edit.characters!.includes(c.normalizedName)
          )

          if (toMerge.length >= 2) {
            // Create merged character
            const merged: ExtractedCharacter = {
              name: edit.newName,
              normalizedName: edit.newName.toUpperCase(),
              replicaCount: toMerge.reduce((sum, c) => sum + c.replicaCount, 0),
              firstAppearance: Math.min(...toMerge.map(c => c.firstAppearance)),
              variants: toMerge.flatMap(c => c.variants),
              possibleGroup: toMerge.some(c => c.possibleGroup)
            }

            // Remove old characters and add merged
            characters = characters.filter(c =>
              !edit.characters!.includes(c.normalizedName)
            )
            characters.push(merged)

            // Update groups
            groups = groups.filter(g =>
              !edit.characters!.some(c => g.members.includes(c))
            )
            groups.push({
              primaryName: merged.normalizedName,
              members: [merged.normalizedName],
              totalReplicas: merged.replicaCount
            })
          }
        }
        break

      case "delete":
        if (edit.character) {
          characters = characters.filter(c => c.normalizedName !== edit.character)
          groups = groups.filter(g => !g.members.includes(edit.character!))
        }
        break

      case "rename":
        if (edit.character && edit.newName) {
          const char = characters.find(c => c.normalizedName === edit.character)
          if (char) {
            char.name = edit.newName
            char.normalizedName = edit.newName.toUpperCase()
          }

          // Update in groups
          for (const group of groups) {
            const idx = group.members.indexOf(edit.character)
            if (idx >= 0) {
              group.members[idx] = edit.newName.toUpperCase()
              if (group.primaryName === edit.character) {
                group.primaryName = edit.newName.toUpperCase()
              }
            }
          }
        }
        break

      case "mark_group":
        if (edit.character) {
          const char = characters.find(c => c.normalizedName === edit.character)
          if (char) {
            char.possibleGroup = true
          }
        }
        break
    }
  }

  // Re-sort
  characters.sort((a, b) => b.replicaCount - a.replicaCount)
  groups.sort((a, b) => b.totalReplicas - a.totalReplicas)

  return {
    ...result,
    parseResult: {
      ...result.parseResult,
      characters
    },
    characterGroups: groups
  }
}

// ─── Database Conversion ────────────────────────────────────────────────────

/**
 * Convert parsed result to format ready for database insertion
 */
export interface RoleForDatabase {
  role_name: string
  role_name_normalized: string
  replicas_needed: number
  parent_role_id?: string
  source: "script"
}

export interface ConflictForDatabase {
  role_name_a: string
  role_name_b: string
  warning_type: string
  scene_reference?: string
}

export function convertToDbFormat(
  result: ParsedScriptBundle
): { roles: RoleForDatabase[]; conflicts: ConflictForDatabase[] } {
  const roles: RoleForDatabase[] = []

  // Convert character groups to roles
  for (const group of result.characterGroups) {
    // Primary role
    const primaryChar = result.parseResult.characters.find(
      c => c.normalizedName === group.primaryName
    )

    if (primaryChar) {
      roles.push({
        role_name: primaryChar.name,
        role_name_normalized: primaryChar.normalizedName,
        replicas_needed: primaryChar.replicaCount,
        source: "script"
      })
    }

    // Child roles (variants)
    for (const memberName of group.members) {
      if (memberName === group.primaryName) continue

      const memberChar = result.parseResult.characters.find(
        c => c.normalizedName === memberName
      )

      if (memberChar) {
        roles.push({
          role_name: memberChar.name,
          role_name_normalized: memberChar.normalizedName,
          replicas_needed: memberChar.replicaCount,
          parent_role_id: group.primaryName, // Will be resolved to actual ID later
          source: "script"
        })
      }
    }
  }

  // Convert interactions to conflicts
  const conflicts: ConflictForDatabase[] = result.parseResult.interactions
    .slice(0, 100) // Limit to avoid too many conflicts
    .map(int => ({
      role_name_a: int.characterA,
      role_name_b: int.characterB,
      warning_type: "same_scene",
      scene_reference: int.sceneReference
    }))

  return { roles, conflicts }
}
