/**
 * Text Extraction from various file formats
 * 
 * Extracts plain text from:
 * - .txt files (direct)
 * - .pdf files (using pdf.js)
 * - .docx files (using mammoth-style parsing)
 */

/**
 * Extract text from a PDF file using PDF.js
 * Note: This runs client-side due to PDF.js requirements
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import of PDF.js — use standard entry point (v5.x)
  const pdfjsLib = await import("pdfjs-dist")

  // Disable the worker for client-side use (avoids worker URL configuration issues)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ""

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
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
  const JSZip = (await import("jszip")).default
  
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
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
            warnings.push("PDF extraction resulted in very little text. The PDF may be image-based.")
          }
        } catch (pdfError) {
          console.error("PDF extraction error:", pdfError)
          throw new Error("Failed to extract text from PDF. Try converting to TXT format.")
        }
        break
        
      case "docx":
        try {
          text = await extractTextFromDOCX(file)
        } catch (docxError) {
          console.error("DOCX extraction error:", docxError)
          throw new Error("Failed to extract text from DOCX. Try converting to TXT format.")
        }
        break
        
      case "doc":
        try {
          text = await extractTextFromDOC(file)
          warnings.push("DOC format extraction may be less accurate. Consider converting to DOCX for better results.")
        } catch (docError) {
          console.error("DOC extraction error:", docError)
          throw new Error("פורמט DOC ישן אינו נתמך לחילוץ טקסט. המר ל-DOCX ונסה שוב.")
        }
        break

      case "xlsx":
      case "xls":
        try {
          text = await extractTextFromExcel(file)
          warnings.push("Excel file imported as role list. Ensure the first column has role names and the second has replica counts.")
        } catch (excelError) {
          console.error("Excel extraction error:", excelError)
          throw new Error("Failed to read Excel file. Ensure it contains role names in the first column.")
        }
        break

      case "csv":
        try {
          text = await extractTextFromCSV(file)
          warnings.push("CSV file imported as role list. Ensure the first column has role names and the second has replica counts.")
        } catch (csvError) {
          console.error("CSV extraction error:", csvError)
          throw new Error("Failed to read CSV file.")
        }
        break
        
      default:
        throw new Error(`פורמט קובץ לא נתמך: .${extension ?? "unknown"}`)
    }
    
    // Basic validation
    if (!text || text.trim().length === 0) {
      throw new Error("File appears to be empty")
    }
    
    // Check for common issues
    const lines = text.split("\n")
    const uppercaseLines = lines.filter(l => l.trim() && l.trim() === l.trim().toUpperCase())
    
    if (uppercaseLines.length < 5) {
      warnings.push("Very few uppercase lines detected. Make sure this is a properly formatted screenplay.")
    }
    
    return { text, warnings }
    
  } catch (error) {
    throw error
  }
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
  const supported = ["txt", "pdf", "docx", "doc", "xlsx", "xls", "csv"].includes(extension)
  
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
