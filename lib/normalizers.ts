/**
 * Normalize email for duplicate detection
 * - Lowercase
 * - Trim whitespace
 */
export function normalizeEmail(email: string): string {
  if (!email) return ""
  return email.toLowerCase().trim()
}

/**
 * Normalize phone number for duplicate detection
 * - Remove all non-digits
 * - Convert +972 to 0 (Israeli international prefix)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ""
  
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, "")
  
  // Convert Israeli international prefix to local
  if (normalized.startsWith("972")) {
    normalized = "0" + normalized.slice(3)
  }
  
  return normalized
}

/**
 * Check if two normalized phones match
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1)
  const n2 = normalizePhone(phone2)
  return n1 !== "" && n2 !== "" && n1 === n2
}

/**
 * Check if two normalized emails match
 */
export function emailsMatch(email1: string, email2: string): boolean {
  const n1 = normalizeEmail(email1)
  const n2 = normalizeEmail(email2)
  return n1 !== "" && n2 !== "" && n1 === n2
}
