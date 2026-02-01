/**
 * Fuzzy Matching for Character Names
 * 
 * Uses Levenshtein distance and other heuristics to find similar character names
 * that might be the same character with different spellings.
 */

import type { ExtractedCharacter, ParserWarning } from "./script-parser"

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  
  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }
  
  return dp[m][n]
}

/**
 * Calculate similarity ratio (0-1) between two strings
 */
export function similarityRatio(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

/**
 * Check if one name contains the other (for variants like "DR. SMITH" and "SMITH")
 */
function containsName(name1: string, name2: string): boolean {
  const words1 = name1.split(/\s+/)
  const words2 = name2.split(/\s+/)
  
  // Check if all words of the shorter name appear in the longer name
  const [shorter, longer] = words1.length <= words2.length ? [words1, words2] : [words2, words1]
  
  return shorter.every(word => longer.includes(word))
}

/**
 * Common title prefixes that might cause false differences
 */
const TITLES = ["MR", "MRS", "MS", "MISS", "DR", "PROF", "SIR", "LADY", "LORD", "CAPTAIN", "CAPT", "LT", "SGT", "CPL"]

/**
 * Remove title prefixes from a name
 */
function removeTitles(name: string): string {
  const words = name.split(/[\s\.]+/)
  const filtered = words.filter(word => !TITLES.includes(word.toUpperCase()))
  return filtered.join(" ")
}

export interface SimilarityMatch {
  character1: string
  character2: string
  similarity: number
  reason: "levenshtein" | "contains" | "title_variant"
}

/**
 * Find similar characters that might be duplicates
 */
export function findSimilarCharacters(
  characters: ExtractedCharacter[],
  threshold: number = 0.8
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = []
  
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const name1 = characters[i].normalizedName
      const name2 = characters[j].normalizedName
      
      // Skip if already marked as parent-child
      if (characters[i].parentName === name2 || characters[j].parentName === name1) {
        continue
      }
      
      // Check Levenshtein similarity
      const similarity = similarityRatio(name1, name2)
      if (similarity >= threshold) {
        matches.push({
          character1: name1,
          character2: name2,
          similarity,
          reason: "levenshtein"
        })
        continue
      }
      
      // Check if one name contains the other
      if (containsName(name1, name2)) {
        const shorterLen = Math.min(name1.length, name2.length)
        const longerLen = Math.max(name1.length, name2.length)
        // Only match if the shorter is a significant portion
        if (shorterLen / longerLen >= 0.5) {
          matches.push({
            character1: name1,
            character2: name2,
            similarity: shorterLen / longerLen,
            reason: "contains"
          })
          continue
        }
      }
      
      // Check if names match when titles are removed
      const noTitle1 = removeTitles(name1)
      const noTitle2 = removeTitles(name2)
      if (noTitle1 && noTitle2 && noTitle1 !== name1 && noTitle2 !== name2) {
        const titleSimilarity = similarityRatio(noTitle1, noTitle2)
        if (titleSimilarity >= threshold) {
          matches.push({
            character1: name1,
            character2: name2,
            similarity: titleSimilarity,
            reason: "title_variant"
          })
        }
      }
    }
  }
  
  return matches.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Generate warnings from similarity matches
 */
export function generateSimilarityWarnings(matches: SimilarityMatch[]): ParserWarning[] {
  return matches.map(match => {
    let message: string
    switch (match.reason) {
      case "levenshtein":
        message = `"${match.character1}" and "${match.character2}" are very similar (${Math.round(match.similarity * 100)}% match)`
        break
      case "contains":
        message = `"${match.character1}" may be the same as "${match.character2}"`
        break
      case "title_variant":
        message = `"${match.character1}" and "${match.character2}" may be the same character with different titles`
        break
    }
    
    return {
      type: "possible_duplicate" as const,
      message,
      characters: [match.character1, match.character2]
    }
  })
}

export interface CharacterGroup {
  primaryName: string
  members: string[]
  totalReplicas: number
}

/**
 * Group similar characters together
 */
export function groupSimilarCharacters(
  characters: ExtractedCharacter[],
  manualGroups?: { primary: string; members: string[] }[]
): CharacterGroup[] {
  const groups: CharacterGroup[] = []
  const assigned = new Set<string>()
  
  // First, apply manual groups if provided
  if (manualGroups) {
    for (const manual of manualGroups) {
      const primary = characters.find(c => c.normalizedName === manual.primary)
      if (!primary) continue
      
      const members = manual.members.filter(m => 
        characters.some(c => c.normalizedName === m) && !assigned.has(m)
      )
      
      if (members.length > 0) {
        assigned.add(manual.primary)
        members.forEach(m => assigned.add(m))
        
        const allMembers = [manual.primary, ...members]
        const totalReplicas = allMembers.reduce((sum, m) => {
          const char = characters.find(c => c.normalizedName === m)
          return sum + (char?.replicaCount || 0)
        }, 0)
        
        groups.push({
          primaryName: manual.primary,
          members: allMembers,
          totalReplicas
        })
      }
    }
  }
  
  // Then, auto-group based on parent relationships
  for (const char of characters) {
    if (assigned.has(char.normalizedName)) continue
    
    if (char.parentName && !assigned.has(char.parentName)) {
      const parent = characters.find(c => c.normalizedName === char.parentName)
      if (parent) {
        assigned.add(char.normalizedName)
        assigned.add(parent.normalizedName)
        
        // Find all children of this parent
        const children = characters.filter(
          c => c.parentName === parent.normalizedName && !assigned.has(c.normalizedName)
        )
        children.forEach(c => assigned.add(c.normalizedName))
        
        const allMembers = [parent.normalizedName, char.normalizedName, ...children.map(c => c.normalizedName)]
        const totalReplicas = allMembers.reduce((sum, m) => {
          const c = characters.find(ch => ch.normalizedName === m)
          return sum + (c?.replicaCount || 0)
        }, 0)
        
        groups.push({
          primaryName: parent.normalizedName,
          members: allMembers,
          totalReplicas
        })
      }
    }
  }
  
  // Finally, add remaining characters as single-member groups
  for (const char of characters) {
    if (!assigned.has(char.normalizedName)) {
      groups.push({
        primaryName: char.normalizedName,
        members: [char.normalizedName],
        totalReplicas: char.replicaCount
      })
    }
  }
  
  return groups.sort((a, b) => b.totalReplicas - a.totalReplicas)
}
