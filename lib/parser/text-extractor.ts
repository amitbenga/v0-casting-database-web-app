/**
 * Text Extraction from various file formats
 *
 * Extracts plain text from:
 * - .txt files (direct)
 * - .pdf files (using pdf.js)
 * - .docx files (using mammoth-style parsing)
 *
 * Also exports structured table extractors:
 * - extractTablesFromPDF  — column-detection via x-coordinate clustering
 * - extractTablesFromDOCX — explicit <w:tbl> XML parsing
 */

import type { StructuredParseResult } from "./structured-parser"

/**
 * Extract text from a PDF file using PDF.js
 * Note: This runs client-side due to PDF.js requirements
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import of PDF.js — use standard entry point (v5.x)
  const pdfjsLib = await import("pdfjs-dist")

  // Set worker source to the bundled worker file
  // In Next.js, we use a CDN fallback or the installed package worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      // Try to use the package worker URL (works in modern bundlers)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ""
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
  }).promise
  
  const textParts: string[] = []
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    
    // Group text items by their Y position to maintain line structure
    const lineMap = new Map<number, { x: number; text: string }[]>()
    
    for (const item of textContent.items) {
      if ("str" in item && item.str.trim()) {
        // Round Y to group nearby items into the same line
        const y = Math.round(item.transform[5] / 5) * 5
        
        if (!lineMap.has(y)) {
          lineMap.set(y, [])
        }
        
        lineMap.get(y)!.push({
          x: item.transform[4],
          text: item.str
        })
      }
    }
    
    // Sort lines by Y position (top to bottom) and items by X position (left to right)
    const sortedLines = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0]) // Higher Y = top of page
    
    for (const [, items] of sortedLines) {
      items.sort((a, b) => a.x - b.x)
      
      // Join items with appropriate spacing
      let lineText = ""
      let lastX = 0
      
      for (const item of items) {
        // Add spaces based on gap between items
        const gap = item.x - lastX
        if (lastX > 0 && gap > 20) {
          lineText += "    " // Large gap = probably centered text
        } else if (lastX > 0 && gap > 5) {
          lineText += " "
        }
        lineText += item.text
        lastX = item.x + item.text.length * 5 // Approximate text width
      }
      
      textParts.push(lineText)
    }
    
    textParts.push("") // Page break
  }
  
  return textParts.join("\n")
}

/**
 * Extract text from a DOCX file
 * Uses basic XML parsing to extract text content
 */
export async function extractTextFromDOCX(file: File): Promise<string> {
  // DOCX is a ZIP file containing XML
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JSZip: any
  try {
    const mod = await import("jszip")
    JSZip = mod.default ?? mod
  } catch {
    throw new Error("JSZip library not available for DOCX extraction")
  }

  const arrayBuffer = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let zip: any
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch {
    throw new Error("Invalid DOCX file: cannot open as ZIP archive")
  }

  // Main document content is in word/document.xml
  const docXml = await zip.file("word/document.xml")?.async("text")

  if (!docXml) {
    throw new Error("Invalid DOCX file: missing document.xml")
  }
  
  // Parse XML and extract text
  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, "application/xml")
  
  // Find all paragraph elements
  const paragraphs = doc.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "p"
  )
  
  const textParts: string[] = []
  
  for (const para of paragraphs) {
    // Find all text elements within this paragraph
    const textNodes = para.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "t"
    )
    
    let paraText = ""
    
    for (const textNode of textNodes) {
      paraText += textNode.textContent || ""
    }
    
    // Check for tabs/indentation
    const tabs = para.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "tab"
    )
    
    // Add leading spaces for indentation
    const indent = tabs.length > 0 ? "                    " : ""
    
    if (paraText.trim()) {
      textParts.push(indent + paraText)
    } else {
      textParts.push("")
    }
  }
  
  return textParts.join("\n")
}

// ─── Structured table extractors ─────────────────────────────────────────────

/**
 * Extract table data from a PDF file by analysing x/y coordinates.
 *
 * Algorithm:
 *  1. For each page, collect all text items with their (x, y) positions.
 *  2. Cluster x-positions → columns (positions that repeat across ≥30 % of rows).
 *  3. Group items into rows by y-position (same rounding as extractTextFromPDF).
 *  4. Assign each item to its nearest column bucket.
 *  5. The first row becomes the headers; subsequent rows become data rows.
 *
 * Returns an empty array if no consistent table structure is found.
 * Caps analysis at MAX_PAGES pages and MAX_ROWS rows for performance.
 */
export async function extractTablesFromPDF(
  file: File
): Promise<StructuredParseResult[]> {
  const MAX_PAGES = 50
  const MAX_ROWS = 1000
  const MIN_COLUMNS = 3
  const MIN_DATA_ROWS = 5

  const pdfjsLib = await import("pdfjs-dist")

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ""
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
  }).promise

  const pagesToProcess = Math.min(pdf.numPages, MAX_PAGES)

  // Collect all items across pages
  type Item = { x: number; y: number; text: string; page: number }
  const allItems: Item[] = []

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height

    for (const item of textContent.items) {
      if ("str" in item && item.str.trim()) {
        // Normalise y so that top-of-page = 0 increasing downwards
        const yRaw = pageHeight - item.transform[5]
        allItems.push({
          x: Math.round(item.transform[4]),
          y: Math.round(yRaw),
          text: item.str,
          page: pageNum,
        })
      }
    }

    if (allItems.length >= MAX_ROWS * 5) break
  }

  if (allItems.length === 0) return []

  // Cluster x-positions into column buckets (tolerance: 15 px)
  const COLUMN_TOLERANCE = 15
  const xValues = allItems.map((i) => i.x).sort((a, b) => a - b)
  const columnBuckets: number[] = []

  for (const x of xValues) {
    const existing = columnBuckets.find((b) => Math.abs(b - x) <= COLUMN_TOLERANCE)
    if (existing === undefined) {
      columnBuckets.push(x)
    }
  }
  columnBuckets.sort((a, b) => a - b)

  if (columnBuckets.length < MIN_COLUMNS) return []

  // Group items into rows by y-position (tolerance: 5 px)
  const ROW_Y_TOLERANCE = 5
  const rowMap = new Map<number, Item[]>()

  for (const item of allItems) {
    const rowKey =
      Array.from(rowMap.keys()).find((k) => Math.abs(k - item.y) <= ROW_Y_TOLERANCE) ??
      item.y
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, [])
    rowMap.get(rowKey)!.push(item)
  }

  const sortedRows = Array.from(rowMap.entries()).sort(([a], [b]) => a - b)
  if (sortedRows.length < MIN_DATA_ROWS + 1) return []

  // For each row, assign items to the nearest column bucket
  function nearestBucket(x: number): number {
    let best = columnBuckets[0]
    let bestDist = Math.abs(x - best)
    for (const b of columnBuckets) {
      const d = Math.abs(x - b)
      if (d < bestDist) {
        bestDist = d
        best = b
      }
    }
    return best
  }

  // Build a 2-D grid: rows × columns
  const grid: string[][] = sortedRows.slice(0, MAX_ROWS).map(([, items]) => {
    const cells = new Map<number, string[]>()
    for (const item of items) {
      const bucket = nearestBucket(item.x)
      if (!cells.has(bucket)) cells.set(bucket, [])
      cells.get(bucket)!.push(item.text)
    }
    return columnBuckets.map((b) => (cells.get(b) ?? []).join(" ").trim())
  })

  if (grid.length < MIN_DATA_ROWS + 1) return []

  // Filter out sparse rows (fewer than half of columns filled)
  const filledGrid = grid.filter(
    (row) => row.filter((cell) => cell.length > 0).length >= columnBuckets.length / 2
  )

  if (filledGrid.length < MIN_DATA_ROWS + 1) return []

  // First row = headers
  const rawHeaders = filledGrid[0]
  const headers = rawHeaders.map((h, i) => h || `Col${i + 1}`)
  const dataRows = filledGrid.slice(1)

  const rows: Record<string, string | number | null>[] = dataRows.map((row) => {
    const record: Record<string, string | number | null> = {}
    headers.forEach((h, i) => {
      record[h] = row[i] || null
    })
    return record
  })

  return [
    {
      headers,
      rows,
      source: "pdf-table",
      sheetName: file.name,
      totalRows: rows.length,
    },
  ]
}

/**
 * Extract table data from a DOCX file by parsing <w:tbl> XML elements.
 *
 * DOCX tables have an explicit structure:
 *   <w:tbl>           → table
 *     <w:tr>          → row
 *       <w:tc>        → cell
 *         <w:p><w:r><w:t>text</w:t>…
 *
 * The first row of each table becomes the headers.
 * Returns one StructuredParseResult per table with ≥2 columns and ≥MIN_DATA_ROWS rows.
 */
export async function extractTablesFromDOCX(
  file: File
): Promise<StructuredParseResult[]> {
  const MIN_DATA_ROWS = 3
  const MIN_COLUMNS = 2

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let JSZip: any
  try {
    const mod = await import("jszip")
    JSZip = mod.default ?? mod
  } catch {
    return []
  }

  const arrayBuffer = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let zip: any
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch {
    return []
  }

  const docXml = await zip.file("word/document.xml")?.async("text")
  if (!docXml) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, "application/xml")

  const NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

  // Helper: extract all text from a cell element
  function cellText(tc: Element): string {
    const runs = tc.getElementsByTagNameNS(NS, "t")
    let text = ""
    for (const run of runs) {
      text += run.textContent ?? ""
    }
    return text.trim()
  }

  const tables = doc.getElementsByTagNameNS(NS, "tbl")
  const results: StructuredParseResult[] = []

  for (let t = 0; t < tables.length; t++) {
    const table = tables[t]
    const trs = table.getElementsByTagNameNS(NS, "tr")
    if (trs.length < MIN_DATA_ROWS + 1) continue

    // Extract all rows as string arrays
    const grid: string[][] = []
    for (let r = 0; r < trs.length; r++) {
      const tcs = trs[r].getElementsByTagNameNS(NS, "tc")
      const rowCells: string[] = []
      for (let c = 0; c < tcs.length; c++) {
        rowCells.push(cellText(tcs[c]))
      }
      grid.push(rowCells)
    }

    if (grid.length === 0) continue

    // Determine column count from widest row
    const maxCols = Math.max(...grid.map((r) => r.length))
    if (maxCols < MIN_COLUMNS) continue

    // Pad rows to equal width
    const normalized = grid.map((row) => {
      const padded = [...row]
      while (padded.length < maxCols) padded.push("")
      return padded
    })

    // First row = headers
    const rawHeaders = normalized[0]
    const headers = rawHeaders.map((h, i) => h || `Col${i + 1}`)
    const dataRows = normalized.slice(1)

    if (dataRows.length < MIN_DATA_ROWS) continue

    const rows: Record<string, string | number | null>[] = dataRows.map((row) => {
      const record: Record<string, string | number | null> = {}
      headers.forEach((h, i) => {
        record[h] = row[i] || null
      })
      return record
    })

    results.push({
      headers,
      rows,
      source: "docx-table",
      sheetName: `Table ${t + 1}`,
      totalRows: rows.length,
    })
  }

  return results
}

/**
 * Extract text from a plain text file
 */
export async function extractTextFromTXT(file: File): Promise<string> {
  return await file.text()
}

/**
 * Extract text from a DOC file (old Word format)
 * DOC is a binary format - we use a simplified extraction approach
 * that looks for text content within the binary structure
 */
export async function extractTextFromDOC(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  // DOC files have a compound document structure
  // We'll look for text content by finding readable ASCII/Unicode sequences
  
  const textParts: string[] = []
  let currentText = ""
  let consecutiveReadable = 0
  
  // First pass: try to find Unicode text (UTF-16LE which DOC uses)
  for (let i = 0; i < uint8Array.length - 1; i += 2) {
    const char = uint8Array[i] | (uint8Array[i + 1] << 8)
    
    // Check if it's a printable character or common control char
    if ((char >= 32 && char < 127) || char === 9 || char === 10 || char === 13) {
      currentText += String.fromCharCode(char)
      consecutiveReadable++
    } else if (char === 0 && consecutiveReadable > 0) {
      // Null character often appears between words in DOC
      continue
    } else {
      if (consecutiveReadable > 20) {
        // Only keep sequences of at least 20 readable chars
        textParts.push(currentText.trim())
      }
      currentText = ""
      consecutiveReadable = 0
    }
  }
  
  if (consecutiveReadable > 20) {
    textParts.push(currentText.trim())
  }
  
  // If we didn't find much Unicode text, try ASCII extraction
  if (textParts.join("").length < 500) {
    textParts.length = 0
    currentText = ""
    consecutiveReadable = 0
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i]
      
      if ((byte >= 32 && byte < 127) || byte === 9 || byte === 10 || byte === 13) {
        currentText += String.fromCharCode(byte)
        consecutiveReadable++
      } else {
        if (consecutiveReadable > 30) {
          textParts.push(currentText.trim())
        }
        currentText = ""
        consecutiveReadable = 0
      }
    }
    
    if (consecutiveReadable > 30) {
      textParts.push(currentText.trim())
    }
  }
  
  // Filter out binary garbage and metadata
  const cleanedParts = textParts.filter(part => {
    // Skip parts that look like metadata or binary
    if (part.includes("Root Entry") || part.includes("Microsoft")) return false
    if (part.includes("WordDocument") || part.includes("CompObj")) return false
    if (/^[A-Za-z]{1,3}$/.test(part)) return false // Single letters
    // Keep parts that have at least some sentence-like structure
    return part.length > 50 || /[.!?]/.test(part) || /^[A-Z]{2,}/.test(part)
  })
  
  let result = cleanedParts.join("\n\n")
  
  // Clean up the text
  result = result
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  
  if (result.length < 100) {
    throw new Error("Could not extract meaningful text from DOC file. Please convert to DOCX or TXT format for better results.")
  }
  
  return result
}

/**
 * Extract text from a CSV file
 * Converts rows into script-like format: CHARACTER_NAME (replica count)
 */
export async function extractTextFromCSV(file: File): Promise<string> {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  
  if (lines.length === 0) {
    throw new Error("CSV file is empty")
  }

  // Try to detect column structure from header
  const header = lines[0].toLowerCase()
  const hasHeader = header.includes("role") || header.includes("name") || header.includes("תפקיד") || header.includes("שם") || header.includes("character")

  const dataLines = hasHeader ? lines.slice(1) : lines
  const scriptLines: string[] = []

  for (const line of dataLines) {
    // Split by comma (simple CSV - for complex CSV with quoted fields, use a library)
    const parts = line.split(",").map(p => p.trim().replace(/^"(.*)"$/, "$1"))
    
    if (parts.length === 0 || !parts[0]) continue

    const roleName = parts[0].toUpperCase()
    const replicaCount = parts.length > 1 ? parseInt(parts[1]) || 1 : 1

    // Generate fake script lines so the parser can extract the character
    scriptLines.push(`\n${roleName}`)
    for (let i = 0; i < replicaCount; i++) {
      scriptLines.push(`                    Line ${i + 1}`)
    }
  }

  return scriptLines.join("\n")
}

/**
 * Extract text from an Excel file (.xlsx, .xls)
 * Uses SheetJS to parse the spreadsheet and converts to script-like format
 */
export async function extractTextFromExcel(file: File): Promise<string> {
  const XLSX = await import("xlsx")
  
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  
  // Use the first sheet
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Excel file has no sheets")
  
  const sheet = workbook.Sheets[sheetName]
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  
  if (data.length === 0) {
    throw new Error("Excel sheet is empty")
  }

  // Try to detect header row
  const firstRow = data[0]?.map(c => String(c || "").toLowerCase()) || []
  const hasHeader = firstRow.some(c => 
    c.includes("role") || c.includes("name") || c.includes("תפקיד") || 
    c.includes("שם") || c.includes("character") || c.includes("replicas") || c.includes("רפליקות")
  )

  // Find the role name column and replicas column
  let nameCol = 0
  let replicasCol = 1
  
  if (hasHeader) {
    nameCol = firstRow.findIndex(c => c.includes("role") || c.includes("name") || c.includes("תפקיד") || c.includes("שם") || c.includes("character"))
    replicasCol = firstRow.findIndex(c => c.includes("replica") || c.includes("count") || c.includes("רפליקות") || c.includes("כמות"))
    
    if (nameCol === -1) nameCol = 0
    if (replicasCol === -1) replicasCol = nameCol === 0 ? 1 : 0
  }

  const dataRows = hasHeader ? data.slice(1) : data
  const scriptLines: string[] = []

  for (const row of dataRows) {
    if (!row || !row[nameCol]) continue
    
    const roleName = String(row[nameCol]).trim().toUpperCase()
    if (!roleName) continue
    
    const replicaCount = replicasCol < row.length ? (parseInt(String(row[replicasCol])) || 1) : 1

    // Generate fake script lines so the parser can extract the character
    scriptLines.push(`\n${roleName}`)
    for (let i = 0; i < Math.min(replicaCount, 500); i++) {
      scriptLines.push(`                    Line ${i + 1}`)
    }
  }

  if (scriptLines.length === 0) {
    throw new Error("No role data found in Excel file. Ensure the first column contains role names.")
  }

  return scriptLines.join("\n")
}

/**
 * Extract text from any supported file type
 */
export async function extractText(file: File): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = []
  
  const extension = file.name.split(".").pop()?.toLowerCase()
  
  try {
    let text: string
    
    switch (extension) {
      case "txt":
        text = await extractTextFromTXT(file)
        break
        
      case "pdf":
        try {
          text = await extractTextFromPDF(file)
          if (text.trim().length < 100) {
            warnings.push("לא חולץ טקסט מספיק מה-PDF. ייתכן שהקובץ סרוק או מבוסס תמונה.")
          }
        } catch (pdfError) {
          console.error("PDF extraction error:", pdfError)
          throw new Error("לא הצלחנו לחלץ טקסט מה-PDF. אם הקובץ סרוק או כתמונה, נסה להעלות אקסל או לייצא PDF עם טקסט.")
        }
        break

      case "docx":
        try {
          text = await extractTextFromDOCX(file)
        } catch (docxError) {
          console.error("DOCX extraction error:", docxError)
          throw new Error("לא הצלחנו לחלץ טקסט מה-DOCX. נסה לשמור מחדש או להעלות קובץ אחר.")
        }
        break
        
      case "doc":
        // Block old .doc format with a clear Hebrew error message
        throw new Error("פורמט DOC ישן אינו נתמך. אנא המר את הקובץ לפורמט DOCX ונסה שוב.")

      case "xlsx":
      case "xls":
        try {
          text = await extractTextFromExcel(file)
          warnings.push("קובץ Excel יובא כרשימת תפקידים. ודא שהעמודה הראשונה מכילה שמות תפקידים והשנייה — מספר רפליקות.")
        } catch (excelError) {
          console.error("Excel extraction error:", excelError)
          throw new Error("לא ניתן לקרוא את קובץ ה-Excel. ודא שהעמודה הראשונה מכילה שמות תפקידים.")
        }
        break

      case "csv":
        try {
          text = await extractTextFromCSV(file)
          warnings.push("קובץ CSV יובא כרשימת תפקידים. ודא שהעמודה הראשונה מכילה שמות תפקידים והשנייה — מספר רפליקות.")
        } catch (csvError) {
          console.error("CSV extraction error:", csvError)
          throw new Error("לא ניתן לקרוא את קובץ ה-CSV.")
        }
        break
        
      default:
        throw new Error(`Unsupported file format: .${extension}`)
    }
    
    // Basic validation
    if (!text || text.trim().length === 0) {
      throw new Error("הקובץ ריק או לא ניתן לחלץ ממנו טקסט.")
    }

    // Check for common issues
    const lines = text.split("\n")
    const uppercaseLines = lines.filter(l => l.trim() && l.trim() === l.trim().toUpperCase())

    if (uppercaseLines.length < 5) {
      warnings.push("זוהו מעט מאוד שורות באותיות גדולות. ודא שהקובץ בפורמט תסריט תקני.")
    }
    
    return { text, warnings }
    
  } catch (error) {
    throw error
  }
}

/**
 * Normalize extracted text before parsing.
 *
 * Runs after extraction and before the regex parser to improve character
 * detection across common formatting variations:
 *  0. Unicode NFKC normalization (compatibility decomposition + canonical composition)
 *     — merges visually-identical but differently-encoded chars (e.g. "ﬁ"→"fi", fullwidth→ASCII)
 *  1. Strip Unicode bidi control characters (LRM, RLM, LRE, RLE, PDF, etc.)
 *     — PDF and DOCX extractors often inject these; they break regex matching
 *  2. Remove repeated header/footer lines (page numbers, show title, etc.)
 *  3. Merge broken line-wraps (short lines that continue on the next line)
 *  4. Normalize whitespace: collapse multiple spaces/tabs to single space
 *  5. Normalize speaker-colon format: "NAME: dialogue" → "NAME\n    dialogue"
 */
export function normalizeText(text: string): string {
  // ── Step 0: Unicode NFKC ──────────────────────────────────────────────────
  // Converts compatibility characters to their canonical forms.
  // "ﬁ" → "fi", "Ⅷ" → "VIII", fullwidth latin → ASCII, etc.
  let normalized = text.normalize("NFKC")

  // ── Step 1: Strip bidi controls ───────────────────────────────────────────
  // These invisible characters are injected by PDF/DOCX extractors and break
  // regex-based character-name matching.
  // U+200B ZERO WIDTH SPACE, U+200C ZWNJ, U+200D ZWJ, U+200E LRM, U+200F RLM
  // U+202A LRE, U+202B RLE, U+202C PDF, U+202D LRO, U+202E RLO
  // U+2066 LRI, U+2067 RLI, U+2068 FSI, U+2069 PDI
  // U+FEFF BOM
  normalized = normalized.replace(
    /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
    ""
  )

  const rawLines = normalized.split(/\r?\n/)

  // ── Step 1: Remove repeated header/footer lines ───────────────────────────
  // Count how many times each trimmed non-empty line appears.
  // Lines that repeat more than once across every N lines are likely
  // page headers or footers (show title, page number, etc.).
  const lineFreq = new Map<string, number>()
  for (const line of rawLines) {
    const t = line.trim()
    if (t.length === 0) continue
    lineFreq.set(t, (lineFreq.get(t) ?? 0) + 1)
  }

  const nonEmptyLineCount = Array.from(lineFreq.values()).reduce((s, v) => s + v, 0)

  // Short-script guard: skip frequency-based header/footer removal for scripts
  // with fewer than 30 non-empty lines — risk of deleting real dialogue is too high.
  let filteredLines: string[]
  if (nonEmptyLineCount < 30) {
    // Only drop pure page-number lines, keep everything else
    filteredLines = rawLines.filter((line) => {
      const t = line.trim()
      if (t.length === 0) return true
      if (/^\d{1,4}\.?$/.test(t)) return false
      return true
    })
  } else {
    // Threshold: a line that appears on ≥15% of all non-empty lines is a header/footer.
    const repeatThreshold = Math.max(5, Math.floor(nonEmptyLineCount * 0.15))

    filteredLines = rawLines.filter((line) => {
      const t = line.trim()
      if (t.length === 0) return true // keep empty lines (they act as separators)
      const freq = lineFreq.get(t) ?? 1
      if (freq >= repeatThreshold) return false
      // Also drop pure page-number lines: optional digits surrounded by whitespace
      if (/^\d{1,4}\.?$/.test(t)) return false
      return true
    })
  }

  // ── Step 2: Normalize whitespace per line ─────────────────────────────────
  // Collapse runs of spaces/tabs to a single space while keeping leading
  // whitespace intact (leading spaces signal "centered" screenplay elements).
  const wsNormalized = filteredLines.map((line) => {
    const leadMatch = line.match(/^(\s*)/)
    const leading = leadMatch ? leadMatch[1] : ""
    const body = line.trimStart().replace(/[ \t]{2,}/g, " ")
    return leading + body
  })

  // ── Step 3: Merge broken line-wraps ──────────────────────────────────────
  // Dialogue lines in PDF-extracted text are sometimes broken mid-sentence.
  // Heuristic: if a line is short (< 60 chars), ends without punctuation,
  // and the NEXT line also starts with a lowercase letter, merge them.
  const merged: string[] = []
  for (let i = 0; i < wsNormalized.length; i++) {
    const line = wsNormalized[i]
    const next = wsNormalized[i + 1]

    if (
      next !== undefined &&
      line.trim().length > 0 &&
      line.trim().length < 60 &&
      !/[.!?…:,\-—]$/.test(line.trim()) &&
      /^[a-z\u05D0-\u05EA]/.test(next.trim()) // lowercase Latin or Hebrew letter
    ) {
      merged.push(line.trimEnd() + " " + next.trimStart())
      i++ // skip next line
    } else {
      merged.push(line)
    }
  }

  // ── Step 4: Normalize speaker-colon format ────────────────────────────────
  // Some scripts use "CHARACTER: dialogue text" on a single line.
  // Expand these to two lines so the regex parser sees them separately.
  const speakerExpanded = merged.map((line) => {
    const trimmed = line.trim()
    // Match lines starting with an all-caps name followed by a colon and text
    const colonMatch = trimmed.match(/^([A-Z][A-Z0-9 \-'.]{1,40}):\s+(.+)$/)
    if (colonMatch) {
      const leading = line.length - line.trimStart().length
      const indent = " ".repeat(leading)
      return `${indent}${colonMatch[1]}\n${indent}    ${colonMatch[2]}`
    }
    return line
  })

  return speakerExpanded.join("\n")
}

/**
 * Get file info for display
 */
export function getFileInfo(file: File): {
  name: string
  extension: string
  size: string
  supported: boolean
} {
  const extension = file.name.split(".").pop()?.toLowerCase() || ""
  // .doc (old binary Word) is explicitly blocked — users must convert to .docx
  const supported = ["txt", "pdf", "docx", "xlsx", "xls", "csv"].includes(extension)
  
  let size: string
  if (file.size < 1024) {
    size = `${file.size} B`
  } else if (file.size < 1024 * 1024) {
    size = `${(file.size / 1024).toFixed(1)} KB`
  } else {
    size = `${(file.size / (1024 * 1024)).toFixed(1)} MB`
  }
  
  return {
    name: file.name,
    extension,
    size,
    supported
  }
}
