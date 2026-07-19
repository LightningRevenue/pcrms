"use client";

import { useState } from "react";
import { companyLogoUrl } from "@/lib/company-logo";

export function CompanyLogo({
  domain,
  fallbackText,
  size = 24,
  rounded = "rounded",
  className = "",
}: {
  domain: string | null | undefined;
  fallbackText: string;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = companyLogoUrl(domain, size * 2);

  if ((!src || failed) && !fallbackText) return null;

  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`shrink-0 ${rounded} bg-muted border border-border flex items-center justify-center font-medium text-subtle ${className}`}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon URL, not worth next/image config
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`shrink-0 ${rounded} object-contain bg-muted border border-border ${className}`}
    />
  );
}
