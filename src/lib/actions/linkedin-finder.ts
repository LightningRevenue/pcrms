"use server";

import { db } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/workspace";
import { encrypt, decrypt } from "@/lib/encryption";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import crypto from "node:crypto";

const LI_AT_KEY = "linkedin_li_at_cookie";
const PROXY_URL_KEY = "linkedin_proxy_url";

export type LinkedinFinderConfig = { hasCookie: boolean; hasProxy: boolean };

export async function getLinkedinFinderConfig(): Promise<LinkedinFinderConfig> {
  const ctx = await requireWorkspaceAdmin();
  const rows = await db.workspaceSetting.findMany({
    where: { workspaceId: ctx.workspaceId, key: { in: [LI_AT_KEY, PROXY_URL_KEY] } },
  });
  return {
    hasCookie: rows.some((r) => r.key === LI_AT_KEY),
    hasProxy: rows.some((r) => r.key === PROXY_URL_KEY),
  };
}

// proxyUrl example: http://user:pass@core-residential.evomi.com:1000
export async function saveLinkedinFinderConfig(liAtCookie: string, proxyUrl: string): Promise<void> {
  const ctx = await requireWorkspaceAdmin();
  if (!liAtCookie.trim()) throw new Error("li_at cookie is required");
  if (!proxyUrl.trim()) throw new Error("Proxy URL is required");

  await db.$transaction([
    db.workspaceSetting.upsert({
      where: { workspaceId_key: { workspaceId: ctx.workspaceId, key: LI_AT_KEY } },
      update: { value: encrypt(liAtCookie.trim()) },
      create: { workspaceId: ctx.workspaceId, key: LI_AT_KEY, value: encrypt(liAtCookie.trim()) },
    }),
    db.workspaceSetting.upsert({
      where: { workspaceId_key: { workspaceId: ctx.workspaceId, key: PROXY_URL_KEY } },
      update: { value: encrypt(proxyUrl.trim()) },
      create: { workspaceId: ctx.workspaceId, key: PROXY_URL_KEY, value: encrypt(proxyUrl.trim()) },
    }),
  ]);
}

async function getCredentials(workspaceId: string) {
  const rows = await db.workspaceSetting.findMany({
    where: { workspaceId, key: { in: [LI_AT_KEY, PROXY_URL_KEY] } },
  });
  const liAt = rows.find((r) => r.key === LI_AT_KEY)?.value;
  const proxyUrl = rows.find((r) => r.key === PROXY_URL_KEY)?.value;
  if (!liAt || !proxyUrl) throw new Error("Set up your li_at cookie and proxy URL first");
  return { liAt: decrypt(liAt), proxyUrl: decrypt(proxyUrl) };
}

// LinkedIn's internal search API (same one linkedin.com/search/results/people uses under the
// hood) — a plain authenticated GET, no browser needed. `q=guided` + the "People" facet is
// what the search UI itself sends.
const SEARCH_URL = "https://www.linkedin.com/voyager/api/graphql";

type RawProspect = {
  urn: string;
  name: string;
  headline: string | null;
  location: string | null;
  publicIdentifier: string | null;
};

async function searchLinkedin(query: string, liAt: string, proxyUrl: string): Promise<RawProspect[]> {
  const dispatcher = new ProxyAgent(proxyUrl);
  const csrfToken = "ajax:" + crypto.randomInt(1_000_000_000, 9_999_999_999);

  const res = await undiciFetch(
    `${SEARCH_URL}?includeWebMetadata=true&variables=(start:0,origin:GLOBAL_SEARCH_HEADER,query:(keywords:${encodeURIComponent(query)},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd47e4`,
    {
      dispatcher,
      headers: {
        cookie: `li_at=${liAt}; JSESSIONID="${csrfToken}"`,
        "csrf-token": csrfToken,
        "x-restli-protocol-version": "2.0.0",
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error("LinkedIn rejected the session cookie — it may have expired, re-save it in settings");
  }
  if (!res.ok) throw new Error(`LinkedIn search failed (${res.status})`);

  // LinkedIn's internal Voyager response — undocumented and not versioned for external
  // consumers, so this shape is a best-effort guess or it breaks silently on their
  // next redesign, not a real API contract to type strictly.
  const data = (await res.json()) as unknown as {
    data?: { data?: { searchDashClustersByAll?: { elements?: Array<{ items?: Array<{ item?: { entityResult?: Record<string, unknown> } }> }> } } };
  };
  const elements = data?.data?.data?.searchDashClustersByAll?.elements ?? [];

  const prospects: RawProspect[] = [];
  for (const cluster of elements) {
    for (const item of cluster?.items ?? []) {
      const entity = item?.item?.entityResult as
        | {
            entityUrn?: string;
            navigationUrl?: string;
            title?: { text?: string };
            primarySubtitle?: { text?: string };
            secondarySubtitle?: { text?: string };
          }
        | undefined;
      if (!entity) continue;
      const urn = entity.entityUrn;
      const publicIdentifier = entity.navigationUrl?.match(/\/in\/([^/?]+)/)?.[1];
      if (!urn || !entity.title?.text) continue;
      prospects.push({
        urn,
        name: entity.title.text,
        headline: entity.primarySubtitle?.text ?? null,
        location: entity.secondarySubtitle?.text ?? null,
        publicIdentifier: publicIdentifier ?? null,
      });
    }
  }
  return prospects;
}

export type FinderProspect = {
  id: string;
  name: string;
  headline: string | null;
  location: string | null;
  linkedin: string | null;
  importedPersonId: string | null;
};

export async function runLinkedinSearch(query: string): Promise<FinderProspect[]> {
  const ctx = await requireWorkspaceAdmin();
  if (!query.trim()) throw new Error("Enter a search query");

  const { liAt, proxyUrl } = await getCredentials(ctx.workspaceId);
  const raw = await searchLinkedin(query.trim(), liAt, proxyUrl);
  if (!raw.length) return [];

  const rows = await db.$transaction(
    raw.map((p) =>
      db.linkedinProspect.upsert({
        where: { workspaceId_linkedinUrn: { workspaceId: ctx.workspaceId, linkedinUrn: p.urn } },
        update: { name: p.name, headline: p.headline, location: p.location, linkedin: p.publicIdentifier ? `https://www.linkedin.com/in/${p.publicIdentifier}` : null },
        create: {
          workspaceId: ctx.workspaceId,
          query: query.trim(),
          linkedinUrn: p.urn,
          name: p.name,
          headline: p.headline,
          location: p.location,
          linkedin: p.publicIdentifier ? `https://www.linkedin.com/in/${p.publicIdentifier}` : null,
        },
      })
    )
  );

  return rows.map(toFinderProspect);
}

function toFinderProspect(p: {
  id: string; name: string; headline: string | null; location: string | null; linkedin: string | null; importedPersonId: string | null;
}): FinderProspect {
  return { id: p.id, name: p.name, headline: p.headline, location: p.location, linkedin: p.linkedin, importedPersonId: p.importedPersonId };
}

export async function listRecentProspects(): Promise<FinderProspect[]> {
  const ctx = await requireWorkspaceAdmin();
  const rows = await db.linkedinProspect.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toFinderProspect);
}

export async function importProspectToPerson(prospectId: string): Promise<string> {
  const ctx = await requireWorkspaceAdmin();
  const prospect = await db.linkedinProspect.findUnique({
    where: { id: prospectId, workspaceId: ctx.workspaceId },
  });
  if (!prospect) throw new Error("Prospect not found");
  if (prospect.importedPersonId) return prospect.importedPersonId;

  const [firstName, ...rest] = prospect.name.trim().split(/\s+/);
  const person = await db.person.create({
    data: {
      workspaceId: ctx.workspaceId,
      firstName: firstName || prospect.name,
      lastName: rest.join(" ") || null,
      jobTitle: prospect.headline,
      linkedin: prospect.linkedin,
      ownerId: ctx.userId,
      createdById: ctx.userId,
    },
  });

  await db.linkedinProspect.update({ where: { id: prospect.id }, data: { importedPersonId: person.id } });
  return person.id;
}
