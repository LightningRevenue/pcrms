// ponytail: ~35 hardcoded domains covers the real-world case for "is this free webmail,
// not a company domain". No npm package does this cleanly as a static list without either
// pulling in disposable-email blocklists too or doing network calls at install time — add
// more entries here (or revisit a package) only if a real false-negative shows up.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "protonmail.com", "proton.me", "pm.me",
  "gmx.com", "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com", "yandex.ru",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "qq.com", "163.com", "126.com",
  "naver.com",
]);

export function isFreeEmailDomain(domain: string) {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}
