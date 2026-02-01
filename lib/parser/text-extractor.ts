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
  // Dynamic import of PDF.js to avoid server-side issues
  const pdfjsLib = await import("pdfjs-dist")
  
  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
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
        throw new Error("DOC format is not supported. Please convert to DOCX or TXT.")
        
      default:
        throw new Error(`Unsupported file format: .${extension}`)
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
  const supported = ["txt", "pdf", "docx"].includes(extension)
  
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
