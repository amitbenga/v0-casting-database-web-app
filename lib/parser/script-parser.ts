/**
 * Script Parser - Regex-based character extraction from screenplay files
 *
 * Extracts character names from English screenplay text using pattern matching.
 * Supports standard screenplay formats where character names appear:
 * - In uppercase before dialogue
 * - Centered on the page (detected via leading whitespace)
 * - With parenthetical notes like (V.O.), (O.S.), (CONT'D)
 * - With combined roles like JOHN / MARY
 *
 * The parser uses contextual validation: a line is confirmed as a character name
 * when the following line(s) contain dialogue or a parenthetical acting direction.
 */

export interface ExtractedCharacter {
  name: string
  normalizedName: string
  replicaCount: number
  firstAppearance: number // line number
  variants: string[] // different spellings/versions found
  possibleGroup: boolean // CROWD, SOLDIERS, etc.
  parentName?: string // for variants like "YOUNG PADDINGTON" -> "PADDINGTON"
  combinedRole?: string[] // for "JOHN / MARY" -> ["JOHN", "MARY"]
}

export interface ParserWarning {
  type: "possible_duplicate" | "possible_group" | "ambiguous_name" | "interaction" | "combined_role"
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
  /\s*\(V\.?O\.?\)/gi,        // Voice Over
  /\s*\(O\.?S\.?\)/gi,        // Off Screen
  /\s*\(O\.?C\.?\)/gi,        // Off Camera
  /\s*\(CONT['']?D\)/gi,      // Continued
  /\s*\(CONT\)/gi,
  /\s*\(CONTINUING\)/gi,
  /\s*\(SUBTITLED\)/gi,
  /\s*\(FILTERED\)/gi,
  /\s*\(ON (?:TV|RADIO|PHONE|SCREEN|INTERCOM|SPEAKER|MONITOR|TAPE|VIDEO)\)/gi,
  /\s*\(PRE-?LAP\)/gi,
  /\s*\(WHISPER(?:ING|S)?\)/gi,
  /\s*\(SINGING\)/gi,
  /\s*\(OVER\)/gi,
  /\s*\(INTO (?:PHONE|RADIO|INTERCOM|WALKIE|MIC|MICROPHONE)\)/gi,
  /\s*\(SHOUTING\)/gi,
  /\s*\(YELLING\)/gi,
  /\s*\(SCREAMING\)/gi,
  /\s*\(LAUGHING\)/gi,
  /\s*\(CRYING\)/gi,
  /\s*\(READING\)/gi,
  /\s*\(TO (?:HIMSELF|HERSELF|THEMSELVES|SELF)\)/gi,
  /\s*\(UNDER (?:HIS|HER|THEIR) BREATH\)/gi,
  /\s*\(ANGRY|ANGRILY\)/gi,
  /\s*\(SARCASTIC(?:ALLY)?\)/gi,
  /\s*\(QUIETLY\)/gi,
  /\s*\(SOFTLY\)/gi,
  /\s*\(BEAT\)/gi,
  /\s*\(PAUSE\)/gi,
  /\s*\(THEN\)/gi,
  /\s*\(EXCITED(?:LY)?\)/gi,
  /\s*\(NERVOUS(?:LY)?\)/gi,
  /\s*\(IN .{1,20}\)/gi,      // (IN ENGLISH), (IN SPANISH), etc.
  /\s*\(ON .{1,20}\)/gi,      // catch-all for (ON ...)
  /\s*\(SIMULTANEOUS(?:LY)?\)/gi,
  /\s*\(OVERLAPPING\)/gi,
  /\s*\(MOCK(?:ING)?(?:LY)?\)/gi,
]

// Patterns that indicate a group rather than individual character
const GROUP_INDICATORS = [
  /^(ALL|EVERYONE|CROWD|GROUP|CHORUS|MOB|ENSEMBLE)$/i,
  /^(SOLDIERS|GUARDS|CHILDREN|KIDS|PEOPLE|VILLAGERS|TOWNSPEOPLE|PIRATES|WORKERS|STUDENTS|PASSENGERS|PRISONERS)$/i,
  /^(VOICES?|OTHERS?|BYSTANDERS?|ONLOOKERS?)$/i,
  /^(MEN|WOMEN|BOYS|GIRLS|GUYS|LADIES|GENTLEMEN)$/i,
  /\((?:ALL|GROUP|CHORUS|TOGETHER|IN UNISON|EVERYONE)\)/i,
  /\d+\s*(?:SOLDIERS|GUARDS|PEOPLE|VOICES|MEN|WOMEN|KIDS|CHILDREN)/i,
  /^(?:THE\s+)?(?:CROWD|GROUP|CHORUS|MOB|GANG|TEAM|CREW|BAND)\b/i,
]

// Patterns that suggest character variants (same character, different version)
const VARIANT_PATTERNS = [
  { pattern: /^(YOUNG(?:ER)?|OLD(?:ER)?|LITTLE|ADULT|TEEN(?:AGE)?|BABY|CHILD|ELDERLY|MIDDLE[\s-]AGED)\s+(.+)$/i, baseIndex: 2 },
  { pattern: /^(.+)\s+\((?:YOUNG(?:ER)?|OLD(?:ER)?|CHILD|ADULT|TEEN|AGE\s*\d+|ELDERLY|\d+\s*(?:YEARS?|YRS?)(?:\s*OLD)?)\)$/i, baseIndex: 1 },
  { pattern: /^(.+)\s+(?:YOUNG(?:ER)?|OLD(?:ER)?|ELDERLY)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s*['']S\s+VOICE$/i, baseIndex: 1 },
  { pattern: /^(?:THE\s+)?VOICE\s+OF\s+(.+)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s+\(FLASHBACK\)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s+\(DREAM\)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s+\(FANTASY\)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s+\(MEMORY\)$/i, baseIndex: 1 },
  { pattern: /^(.+?)\s+\(NARRATING\)$/i, baseIndex: 1 },
]

// Scene headings
const SCENE_HEADING_PATTERN = /^(?:\d+[\.\)]\s*)?(?:INT(?:ERIOR)?\.?|EXT(?:ERIOR)?\.?|INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?)\s/i

// Screenplay transitions and directions that are NOT character names
const SCREENPLAY_ELEMENTS = [
  // Transitions
  /^FADE\s*(IN|OUT|TO|TO\s*BLACK|UP)/i,
  /^CUT\s*TO/i,
  /^SMASH\s*CUT/i,
  /^MATCH\s*CUT/i,
  /^JUMP\s*CUT/i,
  /^HARD\s*CUT/i,
  /^CROSS\s*CUT/i,
  /^TIME\s*CUT/i,
  /^DISSOLVE\s*(?:TO)?/i,
  /^WIPE\s*(?:TO)?/i,
  /^IRIS\s*(?:IN|OUT)/i,
  /^THE\s*END/i,
  /^FIN$/i,
  /^END\s*CREDITS?/i,
  /^OPENING\s*CREDITS?/i,
  /^TITLE\s*(?:CARD|SEQUENCE)?/i,
  // Page / continuation
  /^(?:MORE|CONT['']?D|\(MORE\)|\(CONT['']?D\))$/i,
  /^CONTINUED/i,
  // Camera directions
  /^ANGLE\s*(?:ON)?/i,
  /^CLOSE\s*(?:ON|UP|SHOT)?/i,
  /^WIDE\s*(?:ON|SHOT)?/i,
  /^EXTREME\s*(?:CLOSE|WIDE)/i,
  /^MEDIUM\s*(?:SHOT)?/i,
  /^LONG\s*(?:SHOT)?/i,
  /^TWO[\s-]?SHOT/i,
  /^POV\s/i,
  /^REVERSE\s*(?:ANGLE)?/i,
  /^(?:PAN|TILT|DOLLY|TRACK|CRANE|ZOOM|PUSH)\s*(?:IN|OUT|TO|UP|DOWN|LEFT|RIGHT)?/i,
  /^AERIAL\s*(?:SHOT|VIEW)?/i,
  /^ESTABLISHING\s*(?:SHOT)?/i,
  /^MOVING\s*SHOT/i,
  /^SPLIT\s*SCREEN/i,
  /^FREEZE\s*FRAME/i,
  /^SLOW\s*MOTION/i,
  /^BACK\s*TO\s*(?:SCENE|PRESENT)?/i,
  // Scene structure
  /^MONTAGE/i,
  /^END\s*(?:OF\s*)?MONTAGE/i,
  /^FLASHBACK/i,
  /^END\s*(?:OF\s*)?FLASHBACK/i,
  /^FLASH\s*(?:CUT|FORWARD)/i,
  /^DREAM\s*SEQUENCE/i,
  /^END\s*(?:OF\s*)?DREAM/i,
  /^FANTASY\s*SEQUENCE/i,
  /^INTERCUT/i,
  /^INTERCUT\s*(?:WITH|BETWEEN|\-)/i,
  /^(?:BEGIN|END)\s*INTERCUT/i,
  /^SERIES\s*OF\s*SHOTS/i,
  /^END\s*SERIES/i,
  /^LATER/i,
  /^MOMENTS?\s*LATER/i,
  /^SAME\s*(?:TIME)?/i,
  /^SIMULTANEOUSLY/i,
  /^CONTINUOUS/i,
  /^(?:NEXT\s*)?(?:MORNING|EVENING|NIGHT|DAWN|DUSK|SUNSET|SUNRISE)/i,
  // Inserts and supers
  /^(?:SUPER|SUPERIMPOSE|CHYRON)\s*[:]/i,
  /^(?:SUPER|SUPERIMPOSE|CHYRON)\b/i,
  /^INSERT\s*[-:]/i,
  /^INSERT\b/i,
  /^TITLE\s*[:]/i,
  /^CARD\s*[:]/i,
  /^(?:TEXT|SCREEN|CAPTION)\s*[:]/i,
  /^ON\s*SCREEN\s*[:]/i,
  /^SUBTITLE\s*[:]/i,
  // Time/place markers
  /^(?:DAY|NIGHT|DUSK|DAWN|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS)$/i,
  /^SAME\s*TIME$/i,
  // Misc
  /^(?:PRE-?LAP|PRELAP)$/i,
  /^(?:SFX|VFX|CGI|SPFX)\s*[:]/i,
  /^(?:MUSIC|SONG|SCORE)\s*[:]/i,
  /^(?:NOTE|NOTES|N\.B\.)\s*[:]/i,
  /^(?:REVISED|REV\.?|DRAFT)/i,
  /^ACT\s+(?:ONE|TWO|THREE|FOUR|FIVE|I{1,3}V?I{0,3}|\d+)/i,
  /^SCENE\s+\d+/i,
  /^END\s+OF\s+ACT/i,
  /^TEASER/i,
  /^TAG$/i,
  /^COLD\s*OPEN/i,
  /^PREVIOUSLY\s*ON/i,
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

  // Remove any remaining trailing parenthetical
  normalized = normalized.replace(/\s*\([^)]*\)\s*$/, "")

  // Remove common suffixes but NOT numbered characters like GUARD 1
  normalized = normalized
    .replace(/\s*#\d+$/g, "") // Character #1 -> Character (keep just the base for normalization? No, keep it)
    .trim()

  // Don't strip trailing numbers - GUARD 1 and GUARD 2 are DIFFERENT characters

  return normalized
}

/**
 * Check if a name looks like a group
 */
function isGroupCharacter(name: string): boolean {
  return GROUP_INDICATORS.some(pattern => pattern.test(name))
}

/**
 * Check if a line is a screenplay element (transition, direction, etc.)
 */
function isScreenplayElement(line: string): boolean {
  return SCREENPLAY_ELEMENTS.some(pattern => pattern.test(line))
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
 * Detect combined/dual roles like "JOHN / MARY" or "JOHN/MARY"
 */
function detectCombinedRole(name: string): string[] | null {
  // Match patterns like "NAME / NAME" or "NAME/NAME"
  const parts = name.split(/\s*\/\s*/)
  if (parts.length >= 2 && parts.every(p => p.trim().length >= 2)) {
    return parts.map(p => p.trim())
  }
  return null
}

/**
 * Check if a line looks like dialogue text
 * Dialogue lines typically have lowercase words and are sentence-like
 */
function looksLikeDialogue(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  // Parenthetical stage direction within dialogue: (sighing), (beat), etc.
  if (/^\(.+\)$/.test(trimmed)) return true

  // Has a mix of upper and lowercase, or starts lowercase
  if (/[a-z]/.test(trimmed)) return true

  // Starts with punctuation (continuation of dialogue)
  if (/^[…\-—"']/.test(trimmed)) return true

  return false
}

/**
 * Check if the next non-empty lines look like dialogue follows this character name
 * This provides contextual confirmation that a line IS a character name
 */
function hasDialogueFollowing(lines: string[], currentIndex: number): boolean {
  // Look at the next few lines (skip empty lines)
  let checked = 0
  for (let i = currentIndex + 1; i < lines.length && checked < 3; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) continue // skip empty lines
    checked++

    // If next content line is dialogue or parenthetical direction, this is likely a character name
    if (looksLikeDialogue(trimmed)) return true

    // If next line is another character name (ALL CAPS, short), this could be dual dialogue
    // Don't confirm, but don't deny either
    if (checked === 1 && trimmed === trimmed.toUpperCase() && trimmed.length < 30) {
      continue
    }

    // If next content line is a scene heading, this was probably not a character name
    if (SCENE_HEADING_PATTERN.test(trimmed)) return false

    break
  }

  return false
}

/**
 * Main character name extraction with contextual validation
 */
function extractCharacterFromLine(
  line: string,
  lineIndex: number,
  lines: string[]
): string | null {
  const trimmed = line.trim()

  // Skip empty lines
  if (!trimmed) return null

  // Skip lines that are too long (character names are usually short)
  if (trimmed.length > 60) return null

  // Skip scene headings
  if (SCENE_HEADING_PATTERN.test(trimmed)) return null

  // Skip screenplay elements (transitions, directions, inserts, etc.)
  if (isScreenplayElement(trimmed)) return null

  // Skip parenthetical stage directions (lines starting and ending with parentheses)
  if (/^\(.+\)$/.test(trimmed)) return null

  // Skip numbered scene headers
  if (/^\d+[\.\)]\s/.test(trimmed) && !SCENE_HEADING_PATTERN.test(trimmed)) {
    // But allow if it could be a character name after the number
    // e.g., "1. JOHN" is a scene, but we already filter scene headings above
    return null
  }

  // Skip lines that look like dialogue (significant lowercase content)
  const words = trimmed.split(/\s+/)
  const lowercaseWordCount = words.filter(w => /^[a-z]/.test(w)).length
  // More forgiving: allow up to 40% lowercase (for things like "MR. von TRAPP")
  // But short lines (1-2 words) must be fully uppercase
  if (words.length <= 2 && lowercaseWordCount > 0) {
    // Allow specific patterns like "Mc" or "Mac" prefixed names
    const hasNamePrefix = words.some(w => /^(?:Mc|Mac|de|von|van|di|la|le|el|al|O')[A-Z]/.test(w))
    if (!hasNamePrefix) return null
  } else if (lowercaseWordCount > words.length * 0.4) {
    return null
  }

  // Check if line has significant leading whitespace (centered in screenplay)
  const leadingSpaces = line.length - line.trimStart().length
  const hasCenterIndicator = leadingSpaces >= 10

  // Pattern 1: Standard - All uppercase with optional parenthetical
  // JOHN or JOHN (V.O.) or JOHN (CONT'D) or JOHN / MARY
  const pattern1 = /^([A-Z][A-Z0-9\s\-''\.\,#\/]+)(\s*\([^)]+\))?$/

  // Pattern 2: With colon - CHARACTER NAME: (some scripts use this)
  const pattern2 = /^([A-Z][A-Z0-9\s\-''\.\/]+):\s*$/

  // Pattern 3: Numbered character - CHARACTER #1 or CHARACTER 1
  const pattern3 = /^([A-Z][A-Z\s\-''\.]+)\s*[#]?\d+(\s*\([^)]+\))?$/

  // Pattern 4: Tab-indented character name (common in some formats)
  const pattern4 = /^\t+([A-Z][A-Z0-9\s\-''\.\/]+)(\s*\([^)]+\))?$/

  // Pattern 5: Character with number preserved - GUARD 1, COP 2, etc.
  const pattern5 = /^([A-Z][A-Z\s\-''\.]+\s+\d+)(\s*\([^)]+\))?$/

  // Try each pattern
  let match = trimmed.match(pattern1)
  if (!match) match = trimmed.match(pattern2)
  if (!match) match = line.match(pattern4) // Use original line for tab pattern
  if (!match) match = trimmed.match(pattern5)
  if (!match) match = trimmed.match(pattern3)

  if (match) {
    let potentialName = match[1].trim()

    // Remove trailing colon if present
    potentialName = potentialName.replace(/:$/, "").trim()

    // Must have at least 2 characters
    if (potentialName.length < 2) return null

    // Should not be all numbers
    if (/^\d+$/.test(potentialName)) return null

    // Re-check against screenplay elements after extraction
    if (isScreenplayElement(potentialName)) return null

    // Skip very short common words unless centered or followed by dialogue
    const commonWords = [
      "THE", "AND", "BUT", "FOR", "NOT", "YOU", "ALL", "CAN",
      "HAD", "HER", "WAS", "ONE", "OUR", "OUT", "END", "DAY",
      "HIS", "HAS", "HOW", "WHO", "WHY", "YES", "YET",
      "SET", "NEW", "NOW", "OLD", "RUN", "SAY", "SAW",
      "SEE", "SIT", "TOP", "TRY", "USE", "WAY",
    ]
    if (potentialName.length <= 3 && commonWords.includes(potentialName)) {
      // Only allow if centered AND dialogue follows
      if (!hasCenterIndicator || !hasDialogueFollowing(lines, lineIndex)) {
        return null
      }
    }

    // Contextual validation: check if dialogue follows
    // For non-centered names, require dialogue confirmation
    if (!hasCenterIndicator && potentialName.length <= 4 && !hasDialogueFollowing(lines, lineIndex)) {
      return null
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

  const lines = text.split(/\r?\n/)
  const characterMap = new Map<string, ExtractedCharacter>()
  const warnings: ParserWarning[] = []
  const interactions: Interaction[] = []

  let currentScene: string | undefined
  let recentCharacters: { name: string; line: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Check for scene heading
    if (SCENE_HEADING_PATTERN.test(line.trim())) {
      currentScene = line.trim().substring(0, 80)
      recentCharacters = [] // Reset for new scene
      continue
    }

    // Try to extract character name (with contextual validation)
    const rawName = extractCharacterFromLine(line, i, lines)
    if (!rawName) continue

    const normalizedName = normalizeCharacterName(rawName)
    if (!normalizedName) continue

    // Check for combined roles (JOHN / MARY)
    const combinedParts = detectCombinedRole(normalizedName)

    if (combinedParts) {
      // Register each part as a separate character linked together
      for (const part of combinedParts) {
        const partNormalized = normalizeCharacterName(part)
        registerCharacter(
          characterMap, warnings, partNormalized, part, lineNumber, combinedParts
        )

        // Track interactions
        trackInteractions(interactions, recentCharacters, partNormalized, currentScene, lineNumber)
        recentCharacters.push({ name: partNormalized, line: lineNumber })
      }

      // Add combined role warning
      warnings.push({
        type: "combined_role",
        message: `"${rawName}" is a combined role - these characters may be played by the same actor`,
        characters: combinedParts.map(p => normalizeCharacterName(p)),
        lineReference: lineNumber
      })
    } else {
      // Single character
      registerCharacter(characterMap, warnings, normalizedName, rawName, lineNumber)
      trackInteractions(interactions, recentCharacters, normalizedName, currentScene, lineNumber)
      recentCharacters.push({ name: normalizedName, line: lineNumber })
    }

    // Keep only last 15 recent characters per scene for performance
    if (recentCharacters.length > 15) {
      recentCharacters.shift()
    }
  }

  // Post-processing
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
 * Register a character in the character map
 */
function registerCharacter(
  characterMap: Map<string, ExtractedCharacter>,
  warnings: ParserWarning[],
  normalizedName: string,
  rawName: string,
  lineNumber: number,
  combinedRole?: string[]
): void {
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
      parentName: baseCharacter || undefined,
      combinedRole: combinedRole || undefined
    })

    if (isGroup) {
      warnings.push({
        type: "possible_group",
        message: `"${rawName}" appears to be a group character`,
        characters: [normalizedName]
      })
    }
  }
}

/**
 * Track interactions between characters in the same scene
 */
function trackInteractions(
  interactions: Interaction[],
  recentCharacters: { name: string; line: number }[],
  normalizedName: string,
  currentScene: string | undefined,
  lineNumber: number
): void {
  for (const recent of recentCharacters) {
    if (recent.name !== normalizedName) {
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
      const warningChars = [...warning.characters].sort().join("|")
      const isDuplicate = allWarnings.some(
        w => w.type === warning.type &&
            [...w.characters].sort().join("|") === warningChars
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
