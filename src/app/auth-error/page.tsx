import { redirect } from "next/navigation";

// Auth.js's `pages.error` target — reached only for thrown auth errors (e.g.
// OAuthAccountNotLinked from clicking "Add account" in Settings while logged in), never for
// the string-redirect errors this app returns directly from signIn() (like WorkspaceRejected),
// which bypass pages.error entirely and go straight to their own redirect target.
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error === "OAuthAccountNotLinked") {
    redirect("/settings/accounts/emails?error=CantConnect");
  }

  redirect("/login");
}
