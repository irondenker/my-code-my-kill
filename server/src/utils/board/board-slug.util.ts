const BOARD_SLUG_ALIAS_MAP: Record<string, string> = {
  useronly: 'user-only',
};

/**
 * Normalize legacy/alias slugs into canonical board slugs.
 */
export function normalizeBoardSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return BOARD_SLUG_ALIAS_MAP[normalized] ?? normalized;
}
