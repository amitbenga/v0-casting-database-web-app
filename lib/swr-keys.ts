/**
 * Centralized SWR key factory — single source of truth for all cache keys.
 *
 * Rules:
 * - Every SWR key in the app MUST come from this module.
 * - Keys are stable string tuples (never objects).
 * - Related keys share prefixes so we can invalidate by pattern if needed.
 */

export const swrKeys = {
  actors: {
    /** Key-generator for useSWRInfinite pages (returns [prefix, cursor]) */
    infinite: (cursor: string | null): [string, string | null] => ["actors", cursor],
  },

  projects: {
    list: () => "projects" as const,
    detail: (projectId: string) => `projects/${projectId}` as const,
    progress: (projectId: string) => `projects/${projectId}/progress` as const,
  },

  folders: {
    list: () => "folders" as const,
    detail: (folderId: string) => `folders/${folderId}` as const,
  },
} as const
