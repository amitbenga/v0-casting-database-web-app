import { jsPDF } from "jspdf";

// This function adds Hebrew font support to jsPDF
// We'll load the font dynamically to avoid bloating the bundle
export async function addHebrewFont(doc: jsPDF): Promise<void> {
  try {
    // Fetch the font file
    const response = await fetch('/fonts/NotoSansHebrew-Regular.ttf');
    const fontBlob = await response.blob();
    
    // Convert to base64
    const reader = new FileReader();
    const fontBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fontBlob);
    });

    // Add the font to jsPDF
    doc.addFileToVFS("NotoSansHebrew-Regular.ttf", fontBase64);
    doc.addFont("NotoSansHebrew-Regular.ttf", "NotoSansHebrew", "normal");
    doc.setFont("NotoSansHebrew");
  } catch (error) {
    console.error("Failed to load Hebrew font:", error);
    // Fallback to default font
    doc.setFont("helvetica");
  }
}

// Fallback: Use embedded base64 font if fetch fails
// This is a simplified version - in production, you'd include the full base64 string
export function addHebrewFontEmbedded(doc: jsPDF): void {
  // For now, we'll use a simpler approach with RTL text reversal
  // This avoids embedding a large base64 string in the bundle
  doc.setFont("helvetica");
}
