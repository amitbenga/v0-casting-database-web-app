/**
 * Script Parser Module
 * 
 * Main entry point for the script parsing functionality.
 * Combines text extraction, character parsing, and fuzzy matching.
 */

export * from "./script-parser"
export * from "./fuzzy-matcher"
export * from "./text-extractor"

import { extractText, getFileInfo } from "./text-extractor"
import { parseScript, mergeParseResults, type ScriptParseResult, type ExtractedCharacter } from "./script-parser"
import { findSimilarCharacters, generateSimilarityWarnings, groupSimilarCharacters, type CharacterGroup } from "./fuzzy-matcher"

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
}

/**
 * Parse multiple script files and return combined results
 * This is the main function to call from the UI
 */
export async function parseScriptFiles(files: File[]): Promise<ParsedScriptBundle> {
  const results: ScriptParseResult[] = []
  const extractionWarnings: string[] = []
  const fileStatuses: ParsedScriptBundle["files"] = []
  
  for (const file of files) {
    const fileInfo = getFileInfo(file)
    
    if (!fileInfo.supported) {
      fileStatuses.push({
        name: file.name,
        size: fileInfo.size,
        status: "error",
        error: `Unsupported format: .${fileInfo.extension}`
      })
      continue
    }
    
    try {
      const { text, warnings } = await extractText(file)
      extractionWarnings.push(...warnings.map(w => `${file.name}: ${w}`))
      
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
  
  // Merge all results
  const mergedResult = results.length > 0 
    ? mergeParseResults(results)
    : {
        characters: [],
        warnings: [],
        interactions: [],
        metadata: { totalLines: 0, totalReplicas: 0, parseTime: 0 }
      }
  
  // Find similar characters using fuzzy matching
  const similarityMatches = findSimilarCharacters(mergedResult.characters, 0.75)
  
  // Add similarity warnings to the result
  const similarityWarnings = generateSimilarityWarnings(similarityMatches)
  mergedResult.warnings.push(...similarityWarnings)
  
  // Group characters
  const characterGroups = groupSimilarCharacters(mergedResult.characters)
  
  return {
    parseResult: mergedResult,
    characterGroups,
    similarityMatches,
    extractionWarnings,
    files: fileStatuses
  }
}

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
