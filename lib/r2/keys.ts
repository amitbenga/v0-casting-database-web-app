/**
 * Centralized R2 object key builders.
 * All upload paths must go through these helpers to keep the bucket layout consistent.
 *
 * Key conventions:
 *   actor-submissions/{submissionId}/images/{filename}
 *   actor-submissions/{submissionId}/audio/{filename}
 *   actor-submissions/{submissionId}/documents/{filename}
 *   actors/{actorId}/images/{filename}
 *   actors/{actorId}/voice/{filename}
 *   actors/{actorId}/singing/{filename}
 *   projects/{projectId}/scripts/original/{filename}
 *   projects/{projectId}/scripts/translated/{filename}
 *   projects/{projectId}/scripts/processed/{importId}.json
 *   projects/{projectId}/scripts/exports/{filename}
 */

import { sanitizeFilename } from "./utils"

// ---------------------------------------------------------------------------
// Actor submission keys
// ---------------------------------------------------------------------------

export const submissionKeys = {
  image: (submissionId: string, filename: string) =>
    `actor-submissions/${submissionId}/images/${sanitizeFilename(filename)}`,

  audio: (submissionId: string, filename: string) =>
    `actor-submissions/${submissionId}/audio/${sanitizeFilename(filename)}`,

  document: (submissionId: string, filename: string) =>
    `actor-submissions/${submissionId}/documents/${sanitizeFilename(filename)}`,
}

// ---------------------------------------------------------------------------
// Actor media keys
// ---------------------------------------------------------------------------

export const actorKeys = {
  image: (actorId: string, filename: string) =>
    `actors/${actorId}/images/${sanitizeFilename(filename)}`,

  voice: (actorId: string, filename: string) =>
    `actors/${actorId}/voice/${sanitizeFilename(filename)}`,

  singing: (actorId: string, filename: string) =>
    `actors/${actorId}/singing/${sanitizeFilename(filename)}`,
}

// ---------------------------------------------------------------------------
// Project script keys
// ---------------------------------------------------------------------------

export const scriptKeys = {
  original: (projectId: string, filename: string) =>
    `projects/${projectId}/scripts/original/${sanitizeFilename(filename)}`,

  translated: (projectId: string, filename: string) =>
    `projects/${projectId}/scripts/translated/${sanitizeFilename(filename)}`,

  processed: (projectId: string, importId: string) =>
    `projects/${projectId}/scripts/processed/${importId}.json`,

  export: (projectId: string, filename: string) =>
    `projects/${projectId}/scripts/exports/${sanitizeFilename(filename)}`,
}
