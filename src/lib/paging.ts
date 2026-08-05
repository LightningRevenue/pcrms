export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** Clamps a ?page=/?size= pair off a URL into something safe to feed a query. */
export function parsePaging(page?: string, size?: string) {
  const perPage = PAGE_SIZES.includes(Number(size) as (typeof PAGE_SIZES)[number])
    ? Number(size)
    : DEFAULT_PAGE_SIZE;
  return { page: Math.max(1, Number(page) || 1), perPage };
}
