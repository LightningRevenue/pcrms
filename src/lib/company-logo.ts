export function companyLogoUrl(domain: string | null | undefined, size = 64) {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
