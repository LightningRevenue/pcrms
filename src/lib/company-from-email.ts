const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "protonmail.com",
]);

function titleCase(words: string) {
  return words
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// ponytail: strips common TLDs only (.com/.io/.co/...); unusual TLDs stay in the name. Add a real list if it matters.
function companyNameFromDomain(domain: string) {
  const withoutTld = domain.replace(/\.(com|io|co|net|org|dev|app|ro)$/i, "");
  return titleCase(withoutTld);
}

export function deriveCompanyNameFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  return companyNameFromDomain(domain);
}
