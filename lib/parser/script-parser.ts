/**
 * Script Parser - Regex-based character extraction from screenplay files
 * 
 * This module extracts character names from screenplay text using pattern matching.
 * It supports standard screenplay formats where character names appear:
 * - In uppercase before dialogue
 * - Centered on the page (detected via leading whitespace)
 * - Sometimes with parenthetical notes like (V.O.), (O.S.), (CONT'D)
 */

export interface ExtractedCharacter {
  name: string
  normalizedName: string
  replicaCount: number
  firstAppearance: number // line number
  variants: string[] // different spellings/versions found
  possibleGroup: boolean // CROWD, SOLDIERS, etc.
  parentName?: string // for variants like "YOUNG PADDINGTON" -> "PADDINGTON"
}

export interface ParserWarning {
  type: "possible_duplicate" | "possible_group" | "ambiguous_name" | "interaction"
  message: string
  characters: string[]
  lineReference?: number
}

export interface Interaction {
  characterA: string
  characterB: string
  sceneReference?: string
  lineNumber: number
}

export interface ScriptParseResult {
  characters: ExtractedCharacter[]
  warnings: ParserWarning[]
  interactions: Interaction[]
  metadata: {
    totalLines: number
    totalReplicas: number
    parseTime: number
  }
}

// Common parenthetical extensions to strip from character names
const PARENTHETICAL_PATTERNS = [
  /\s*\(V\.?O\.?\)/gi,      // Voice Over
  /\s*\(O\.?S\.?\)/gi,      // Off Screen
  /\s*\(O\.?C\.?\)/gi,      // Off Camera
  /\s*\(CONT['']?D\)/gi,    // Continued
  /\s*\(CONT\)/gi,
  /\s*\(CONTINUING\)/gi,
  /\s*\(SUBTITLED\)/gi,
  /\s*\(FILTERED\)/gi,
  /\s*\(ON (?:TV|RADIO|PHONE|SCREEN)\)/gi,
  /\s*\(PRE-?LAP\)/gi,
  /\s*\(WHISPER(?:ING|S)?\)/gi,
  /\s*\(SINGING\)/gi,
]

// Patterns that indicate a group rather than individual character
const GROUP_INDICATORS = [
  /^(ALL|EVERYONE|CROWD|GROUP|CHORUS|SOLDIERS|GUARDS|CHILDREN|KIDS|PEOPLE|VOICES?|OTHERS?)$/i,
  /\((?:ALL|GROUP|CHORUS|TOGETHER|IN UNISON)\)/i,
  /\d+\s*(?:SOLDIERS|GUARDS|PEOPLE|VOICES)/i,
]

// Patterns that suggest character variants (same character, different version)
const VARIANT_PATTERNS = [
  { pattern: /^(YOUNG|OLD|OLDER|YOUNGER|LITTLE|ADULT|TEEN|TEENAGE?)\s+(.+)$/i, baseIndex: 2 },
  { pattern: /^(.+)\s+\((?:YOUNG|OLD|OLDER|YOUNGER|CHILD|ADULT|TEEN|AGE \d+)\)$/i, baseIndex: 1 },
  { pattern: /^(.+)\s+(?:YOUNG|OLD|OLDER|YOUNGER)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s*['']S\s+VOICE$/i, baseIndex: 1 }, // "JOHN'S VOICE" -> "JOHN"
]

/**
 * Normalize a character name for comparison
 */
export function normalizeCharacterName(name: string): string {
  let normalized = name.trim().toUpperCase()
  
  // Remove parenthetical notes
  for (const pattern of PARENTHETICAL_PATTERNS) {
    normalized = normalized.replace(pattern, "")
  }
  
  // Remove common suffixes
  normalized = normalized
    .replace(/\s*#\d+$/g, "") // Character #1, #2
    .replace(/\s*\d+$/g, "")  // Character 1, 2
    .replace(/['']S$/g, "")   // Possessive
    .trim()
  
  return normalized
}

/**
 * Check if a name looks like a group
 */
function isGroupCharacter(name: string): boolean {
  return GROUP_INDICATORS.some(pattern => pattern.test(name))
}

/**
 * Find the base character name if this is a variant
 */
function findBaseCharacter(name: string): string | null {
  for (const { pattern, baseIndex } of VARIANT_PATTERNS) {
    const match = name.match(pattern)
    if (match && match[baseIndex]) {
      return normalizeCharacterName(match[baseIndex])
    }
  }
  return null
}

/**
 * Main character name extraction
 * Looks for lines that are:
 * - All uppercase (or mostly)
 * - Not too long (character names are usually short)
 * - May have leading whitespace (centered)
 * - May have parenthetical notes
 * 
 * Multiple patterns are tried to catch different screenplay formats
 */
function extractCharacterFromLine(line: string, lineIndex: number): string | null {
  const trimmed = line.trim()
  
  // Skip empty lines
  if (!trimmed) return null
  
  // Skip lines that are too long (likely not a character name)
  if (trimmed.length > 60) return null
  
  // Skip scene headings (INT., EXT., etc.)
  if (/^(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s/i.test(trimmed)) return null
  
  // Skip common screenplay elements
  if (/^(FADE\s*(IN|OUT|TO)|CUT\s*TO|DISSOLVE|SMASH\s*CUT|MATCH\s*CUT|CONTINUED|THE\s*END)/i.test(trimmed)) return null
  if (/^(MORE|CONT['']?D|\(MORE\)|\(CONT['']?D\))$/i.test(trimmed)) return null
  
  // Skip parenthetical stage directions (lines starting and ending with parentheses)
  if (/^\(.+\)$/.test(trimmed)) return null
  
  // Skip numbered scene headers
  if (/^\d+[\.\)]\s/.test(trimmed)) return null
  
  // Skip lines that look like dialogue or action (lowercase words)
  const words = trimmed.split(/\s+/)
  const lowercaseWordCount = words.filter(w => /^[a-z]/.test(w)).length
  if (lowercaseWordCount > words.length * 0.3) return null
  
  // Check if line has significant leading whitespace (centered)
  const leadingSpaces = line.length - line.trimStart().length
  const hasCenterIndicator = leadingSpaces >= 10
  
  // Pattern 1: Standard - All uppercase with optional parenthetical
  // JOHN or JOHN (V.O.) or JOHN (CONT'D)
  const pattern1 = /^([A-Z][A-Z0-9\s\-''\.\,#]+)(\s*\([^)]+\))?$/
  
  // Pattern 2: With colon - CHARACTER NAME: (some scripts use this)
  const pattern2 = /^([A-Z][A-Z0-9\s\-''\.]+):\s*$/
  
  // Pattern 3: Numbered character - CHARACTER #1 or CHARACTER 1
  const pattern3 = /^([A-Z][A-Z\s\-''\.]+)\s*[#]?\d+(\s*\([^)]+\))?$/
  
  // Pattern 4: Tab-indented character name (common in some formats)
  const pattern4 = /^\t+([A-Z][A-Z0-9\s\-''\.]+)(\s*\([^)]+\))?$/
  
  // Try each pattern
  let match = trimmed.match(pattern1)
  if (!match) match = trimmed.match(pattern2)
  if (!match) match = line.match(pattern4) // Use original line for tab pattern
  if (!match) match = trimmed.match(pattern3)
  
  if (match) {
    let potentialName = match[1].trim()
    
    // Remove trailing colon if present
    potentialName = potentialName.replace(/:$/, "").trim()
    
    // Must have at least 2 characters
    if (potentialName.length < 2) return null
    
    // Should not be all numbers
    if (/^\d+$/.test(potentialName)) return null
    
    // Skip very short common words unless centered
    const commonWords = ["THE", "AND", "BUT", "FOR", "NOT", "YOU", "ALL", "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT", "END", "DAY", "MAN", "BOY"]
    if (!hasCenterIndicator && potentialName.length <= 3 && commonWords.includes(potentialName)) {
      return null
    }
    
    // Skip if it looks like a scene direction
    const sceneDirections = ["ANGLE ON", "CLOSE ON", "WIDE ON", "BACK TO", "LATER", "NIGHT", "MORNING", "EVENING", "CONTINUOUS"]
    if (sceneDirections.some(d => potentialName.startsWith(d))) {
      return null
    }
    
    // Debug log for first 50 detected characters
    if (lineIndex < 500) {
      console.log(`[v0] Line ${lineIndex}: Detected character "${potentialName}" from "${trimmed.substring(0, 40)}"`)
    }
    
    return potentialName
  }
  
  return null
}

/**
 * Parse a screenplay text and extract all characters
 */
export function parseScript(text: string): ScriptParseResult {
  const startTime = Date.now()
  
  // Debug: log first part of text
  console.log("[v0] parseScript called with text length:", text.length)
  console.log("[v0] First 500 chars:", text.substring(0, 500))
  
  const lines = text.split(/\r?\n/)
  console.log("[v0] Total lines:", lines.length)
  
  // Debug: log some sample lines
  const sampleLines = lines.slice(0, 30).map((l, i) => `${i}: "${l.substring(0, 60)}"`).join("\n")
  console.log("[v0] First 30 lines:\n", sampleLines)
  const characterMap = new Map<string, ExtractedCharacter>()
  const warnings: ParserWarning[] = []
  const interactions: Interaction[] = []
  
  let currentScene: string | undefined
  let recentCharacters: { name: string; line: number }[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1
    
    // Check for scene heading
    if (/^(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s/i.test(line.trim())) {
      currentScene = line.trim().substring(0, 50)
      recentCharacters = [] // Reset for new scene
      continue
    }
    
    // Try to extract character name
    const rawName = extractCharacterFromLine(line, lineNumber)
    if (!rawName) continue
    
    const normalizedName = normalizeCharacterName(rawName)
    if (!normalizedName) continue
    
    // Check for interactions (characters in same scene)
    for (const recent of recentCharacters) {
      if (recent.name !== normalizedName) {
        // Check if this interaction is already recorded
        const existingInteraction = interactions.find(
          int => 
            (int.characterA === normalizedName && int.characterB === recent.name) ||
            (int.characterA === recent.name && int.characterB === normalizedName)
        )
        
        if (!existingInteraction) {
          interactions.push({
            characterA: normalizedName,
            characterB: recent.name,
            sceneReference: currentScene,
            lineNumber
          })
        }
      }
    }
    
    // Add to recent characters for this scene
    recentCharacters.push({ name: normalizedName, line: lineNumber })
    // Keep only last 10 for performance
    if (recentCharacters.length > 10) {
      recentCharacters.shift()
    }
    
    // Update or create character entry
    if (characterMap.has(normalizedName)) {
      const char = characterMap.get(normalizedName)!
      char.replicaCount++
      if (!char.variants.includes(rawName)) {
        char.variants.push(rawName)
      }
    } else {
      const isGroup = isGroupCharacter(normalizedName)
      const baseCharacter = findBaseCharacter(normalizedName)
      
      characterMap.set(normalizedName, {
        name: rawName,
        normalizedName,
        replicaCount: 1,
        firstAppearance: lineNumber,
        variants: [rawName],
        possibleGroup: isGroup,
        parentName: baseCharacter || undefined
      })
      
      // Add warnings
      if (isGroup) {
        warnings.push({
          type: "possible_group",
          message: `"${rawName}" appears to be a group character`,
          characters: [normalizedName]
        })
      }
    }
  }
  
  // Post-processing: find possible duplicates
  const characters = Array.from(characterMap.values())
  
  // Link variants to their base characters
  for (const char of characters) {
    if (char.parentName) {
      const parent = characterMap.get(char.parentName)
      if (parent) {
        warnings.push({
          type: "possible_duplicate",
          message: `"${char.name}" may be a variant of "${parent.name}"`,
          characters: [char.normalizedName, parent.normalizedName]
        })
      }
    }
  }
  
  // Sort by replica count descending
  characters.sort((a, b) => b.replicaCount - a.replicaCount)
  
  // Add interaction warnings for characters that appear together
  const interactionCounts = new Map<string, number>()
  for (const int of interactions) {
    const key = [int.characterA, int.characterB].sort().join("|")
    interactionCounts.set(key, (interactionCounts.get(key) || 0) + 1)
  }
  
  // Only warn about significant interactions (appear together multiple times)
  for (const [key, count] of interactionCounts) {
    if (count >= 2) {
      const [charA, charB] = key.split("|")
      warnings.push({
        type: "interaction",
        message: `"${charA}" and "${charB}" appear together in ${count} scene(s) - cannot be played by same actor`,
        characters: [charA, charB]
      })
    }
  }
  
  return {
    characters,
    warnings,
    interactions,
    metadata: {
      totalLines: lines.length,
      totalReplicas: characters.reduce((sum, c) => sum + c.replicaCount, 0),
      parseTime: Date.now() - startTime
    }
  }
}

/**
 * Merge results from multiple script files
 */
export function mergeParseResults(results: ScriptParseResult[]): ScriptParseResult {
  const startTime = Date.now()
  
  const characterMap = new Map<string, ExtractedCharacter>()
  const allWarnings: ParserWarning[] = []
  const allInteractions: Interaction[] = []
  let totalLines = 0
  
  for (const result of results) {
    totalLines += result.metadata.totalLines
    
    // Merge characters
    for (const char of result.characters) {
      if (characterMap.has(char.normalizedName)) {
        const existing = characterMap.get(char.normalizedName)!
        existing.replicaCount += char.replicaCount
        for (const variant of char.variants) {
          if (!existing.variants.includes(variant)) {
            existing.variants.push(variant)
          }
        }
      } else {
        characterMap.set(char.normalizedName, { ...char })
      }
    }
    
    // Merge warnings (avoid duplicates)
    for (const warning of result.warnings) {
      const isDuplicate = allWarnings.some(
        w => w.type === warning.type && 
            w.characters.sort().join("|") === warning.characters.sort().join("|")
      )
      if (!isDuplicate) {
        allWarnings.push(warning)
      }
    }
    
    // Merge interactions
    for (const interaction of result.interactions) {
      const isDuplicate = allInteractions.some(
        i => (i.characterA === interaction.characterA && i.characterB === interaction.characterB) ||
             (i.characterA === interaction.characterB && i.characterB === interaction.characterA)
      )
      if (!isDuplicate) {
        allInteractions.push(interaction)
      }
    }
  }
  
  const characters = Array.from(characterMap.values())
  characters.sort((a, b) => b.replicaCount - a.replicaCount)
  
  return {
    characters,
    warnings: allWarnings,
    interactions: allInteractions,
    metadata: {
      totalLines,
      totalReplicas: characters.reduce((sum, c) => sum + c.replicaCount, 0),
      parseTime: Date.now() - startTime
    }
  }
}
