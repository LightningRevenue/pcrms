# Subscription limits audit

Audited every file in `src/lib/actions/*.ts` (33 files) plus the background-worker
counterparts they enqueue into (`campaign-runner.ts`, `sequence-runner.ts`, `run-import.ts`,
`gmail-sync.ts`/`imap-sync.ts` callers) and `prisma/schema.prisma`. All tenant scoping goes
through `requireWorkspace()` / `requireWorkspaceOwner()` / `requireWorkspaceAdmin()` in
`src/lib/workspace.ts`, which returns `{ userId, workspaceId, role }` -- every model below
carries a `workspaceId` column already, so `db.<model>.count({ where: { workspaceId } })` is
a one-line check anywhere a limit needs enforcing.

## Countable resources (candidates for "max N" limits)

| Resource | Prisma model | Creation action(s) | File | Notes |
|---|---|---|---|---|
| Contacts | `Person` | `createContact` | contacts.ts | Also created implicitly by `run-import.ts` (`importPersonRow`). |
| Companies | `Company` | `createCompany`, `resolveCompanyId` (auto-create-on-first-reference from contacts.ts/setPersonCompany/import.ts) | companies.ts, contacts.ts, run-import.ts | `resolveCompanyId` silently creates a Company as a side effect of creating/editing a Person with a new company name -- an easy place to blow a "max companies" limit without an explicit "create company" click. |
| Deals / Opportunities | `Opportunity` | `createOpportunity`, `convertContactToOpportunity` | opportunities.ts | Two entry points create the same model. |
| Tasks | `Task` | `createTask` | tasks.ts | Also created by `sequence-runner.ts` ("task" step type). |
| Notes | `Note` | `createNote` | notes.ts | Also created by `sequence-runner.ts` ("note" step type). |
| Campaigns | `Campaign` | `createCampaign` | campaigns.ts | Marketing/bulk-send feature; see feature area table too. |
| Sequences | `Sequence` | `createSequence` | sequences.ts | Automation/drip feature; see feature area table too. |
| Sequence steps | `SequenceStep` | `addSequenceStep` | sequences.ts | Per-sequence step count -- could gate "max N steps per sequence" as a finer-grained limit. |
| Sequence enrollments | `SequenceEnrollment` | `enrollPersonInSequence` / `enrollPeopleInSequence` | sequences.ts | Bulk variant loops the single-enroll function -- see "Open questions". |
| Workflows | `Workflow` | `createWorkflow` | workflows.ts | Currently just creates an "Untitled" shell + trigger type; no step/action builder found yet. |
| Playbooks | `Playbook` (+ `PlaybookSection`) | `createPlaybook` | playbooks.ts | Creates the Playbook and all its sections in one call -- a single call can create many `PlaybookSection` rows at once. |
| Custom field definitions | `CustomFieldDefinition` | `createFieldDefinition` | custom-fields.ts | Scoped per `objectType` ("company" or "person") -- could limit per-object-type or workspace-wide. |
| Lists | `List` | `createList` | lists.ts | |
| List items | `ListItem` | `addToList` | lists.ts | Membership rows, likely not worth limiting separately from the parent List. |
| Email templates | `EmailTemplate` | `createTemplate` | emails.ts | |
| Outreach mailbox accounts (SMTP/IMAP) | `MailboxAccount` | `createMailboxAccount`, `importMailboxAccountsCsv` (bulk CSV import, loops `.create()` per row) | mailbox-accounts.ts | CSV bulk-import path can create many rows in a single call -- a hard "max mailboxes" limit must be checked per-row or pre-flight, not just once. |
| Twilio voice account | `TwilioAccount` | `saveTwilioAccount` (upsert) | twilio.ts | Schema enforces at most 1 per workspace (`workspaceId @unique`) already -- nothing to limit beyond feature-gating access to Voice at all. |
| Workspace members | `WorkspaceMember` (via `WorkspaceInvite`, accepted at sign-in) | `inviteMember` | members.ts | Membership isn't created directly by this action -- it creates a `WorkspaceInvite`; the actual `WorkspaceMember` row is created later in `ensureWorkspaceMembership()` (workspace.ts) when the invitee signs in. A "max 5 seats" limit needs to count `WorkspaceMember` + un-expired, unaccepted `WorkspaceInvite` rows together. |
| Dashboards | `Dashboard` | `listDashboards` (upsert-on-read of a hardcoded list) | dashboards.ts | NOT user-creatable -- one fixed built-in dashboard ("Sales Tracking") is auto-created on first read via upsert. Not a countable/limitable resource today. |
| Pipeline stages | `PipelineStage` | `createPipelineStage`, `listPipelineStages` (auto-seeds 5 defaults on first read) | pipeline-stages.ts | Same auto-seed-on-read pattern as dashboards; `createPipelineStage` is the real user-facing creation path. Low priority for tiering but technically countable. |
| Favorites | `Favorite` | `toggleFavorite` | favorites.ts | Already limited -- see "Existing limit/quota code found" below. Per-user, not per-workspace. |
| Calls (Twilio Voice) | `Call` | `startCall` | calls.ts | One row per outbound call attempt -- really a volume metric, see usage/volume table. |
| Emails (sent) | `Email` | `sendEmail` (Gmail), `sendViaSmtp`/`sendViaMailboxAccount` (SMTP), `runCampaignSendJob`, `executeStepRun` (sequence) | emails.ts, mailbox-accounts.ts, campaign-runner.ts, sequence-runner.ts | Four different code paths create an `Email` row on send -- a "sends per month" limit needs a shared check point or four separate call sites. See usage/volume table. |
| Import batches | `ImportBatch` | `startImport` | import.ts | The batch row itself is cheap; the real cost is the rows it processes (see usage/volume table). |

## Feature areas (candidates for "available on tier X+" gating)

| Feature area | Action files | What it does | Notes |
|---|---|---|---|
| Marketing campaigns | campaigns.ts, campaign-queue.ts, campaign-runner.ts | Build a static recipient list, pick a template + outreach mailbox(es), bulk-send with randomized 30-60s pacing via BullMQ. | Natural whole-feature gate (e.g. "Campaigns: Pro+"). `startCampaign` is the actual trigger that enqueues sends. |
| Sequences / drip automation | sequences.ts, sequence-runner.ts | Multi-step (email/task/note) drip per contact, cron-driven (`runDueSequenceSteps`, called from cron-jobs.ts). | Distinct from Campaigns (drip vs. one-off blast). Natural whole-feature gate. |
| Workflows automation | workflows.ts, workflow-triggers.ts | Currently only a trigger-type picker (record_created, schedule, webhook, etc.) on an "Untitled" shell -- no step/action execution engine found in this codebase yet. | Feature appears partially built; still a reasonable gate target once the execution engine exists. |
| Twilio voice calling | twilio.ts, calls.ts | Workspace-wide Twilio credentials (Settings > Accounts > Twilio) + browser-based outbound calling via Voice SDK. | Whole-feature gate candidate ("Voice calling: Enterprise"); `isVoiceReady()` (twilio-helpers.ts) already gates the Call button on credentials being configured -- same pattern could add a plan check. |
| Custom fields | custom-fields.ts | Per-workspace custom field definitions for Person/Company, plus values. | Could gate the whole feature or just cap definition count (see countable-resources table). |
| Data import (CSV) | import.ts, import-queue.ts, run-import.ts | CSV upload -> queued background job -> creates Company/Person rows + custom field values row-by-row. | Feature-gate candidate; also has a volume dimension (rows processed) -- see usage table. |
| Outreach inboxes (SMTP/IMAP mailboxes) | mailbox-accounts.ts, mailbox-preferences.ts | Connect non-Gmail mailboxes for sending sequence/campaign email; per-user "which mailboxes are mine" preference. | Underpins both Campaigns and Sequences sending -- could be gated together with those, or independently capped by count. |
| Playbooks | playbooks.ts | Freeform sales-playbook documents (title + ordered sections), workspace-wide. | Lower resource cost; still a reasonable whole-feature or count-based gate. |
| Dashboards / analytics | dashboard.ts, dashboard-stats.ts, dashboards.ts | Home dashboard stats (`getDashboardStats`, `getRecentActivity`) + "Sales Tracking" dashboard (opens/contacts-created/emails-sent/replies trend, per-agent ownership breakdown). | Not user-creatable (see countable-resources note) -- gating here means gating access to the page/stats, not row creation. |
| Lists | lists.ts | Static saved lists of companies/people/opportunities. | Low resource cost; could still be count-capped. |
| Inbox / unified email | inbox.ts, emails.ts | Thread view across Gmail + connected outreach mailboxes; manual send/reply. | Core CRM feature, probably not gated, but the underlying "emails sent" volume is (see usage table). |

## Usage/volume actions (candidates for "N per month" limits)

| Action | File | What consumes | Notes |
|---|---|---|---|
| `sendEmail` | emails.ts | Gmail API send (per-user OAuth) | Manual 1:1 send from Contact/Deal page. |
| `sendViaSmtp` / `sendViaMailboxAccount` | mailbox-accounts.ts | SMTP send via connected outreach inbox | `sendViaMailboxAccount` is also called directly by `campaign-runner.ts` (no `auth()` call -- designed to be callable from a worker with no session). |
| `runCampaignSendJob` | campaign-runner.ts | One `Email` send per campaign member, paced via BullMQ delay (`campaign-queue.ts`) | Triggered in bulk by `startCampaign` -- one call can enqueue hundreds of sends over time. A monthly-send-limit check likely needs to happen either at `startCampaign` (pre-flight, count members against remaining quota) or inside the job itself. |
| `executeStepRun` (email steps) | sequence-runner.ts | One Gmail send per due sequence step, driven by cron (`runDueSequenceSteps`) | Same quota-timing question as campaigns -- steps fire asynchronously across many enrollments, not from a single user action. |
| `startCall` | calls.ts | Creates `Call` row + (client-side) mints a Twilio Voice access token and places a real WebRTC call, billed by Twilio per minute | Real per-call cost; "N calls per month" or "N call-minutes per month" both plausible. `durationSec`/`recordingDurationSec` on `Call` already capture usage data for a minutes-based limit. |
| `startImport` -> `runImport` | import.ts, import-queue.ts, run-import.ts | Background job processes every CSV row into a Company/Person create + Activity + custom field writes | Volume is row count, not visible until the job runs. A pre-flight row-count check in `startImport` (before enqueueing) is the natural place to cap "rows per import" or "rows per month". |
| `checkMailboxAccount` / `checkAllMailboxAccounts` | mailbox-accounts.ts | Live SMTP/IMAP connection test against the mailbox's real server | Cheap per-call but externally-facing; low priority for tiering. |
| `syncContactEmails` / `syncInboxNow` | emails.ts, inbox.ts | Gmail API sync / IMAP poll (`runImapPollAll`) | User-triggered manual sync; also likely run on a schedule (cron-jobs.ts references `runGmailReplySync`). |
| `runGmailSyncNow`, `runSequenceStepsNow`, `runTrashPurgeNow` | cron-jobs.ts | Manually re-triggers the scheduled cron jobs on demand | Admin/debug tooling (Settings > Cron Jobs), not a normal user-facing volume action -- probably out of scope for tenant limits, but an alternate trigger path into the volume actions above. |

## Existing limit/quota code found

- MAX_FAVORITES = 5 (`src/lib/favorites-event.ts`), enforced in `toggleFavorite()`
  (`src/lib/actions/favorites.ts`): `db.favorite.count({ where: { workspaceId, userId } })`
  checked before `.create()`, throws an error if at cap. This is the only real usage limit in
  the codebase today, and it is per-user, not per-workspace/tenant -- a useful template for
  the count-before-create pattern a future tenant-level limit would follow.
- Owner-count guard (`src/lib/actions/members.ts`, `updateMemberRole`):
  `db.workspaceMember.count({ where: { workspaceId, role: "owner" } })` -- not a plan limit,
  just a business-rule floor ("a workspace needs at least one owner") preventing demotion
  below 1 owner.
- Admin usage dashboard (`src/lib/actions/admin.ts`, `getWorkspaceForAdmin`) already computes
  companyCount / personCount / opportunityCount per workspace via
  `db.<model>.count({ where: { workspaceId, deletedAt: null } })` for the platform-admin
  console -- not a limit, but confirms the exact `.count()` shape a tier-limit check would
  reuse, and that platform admins can already see per-tenant volume.
- No plan, tier, subscription, or quota field/model exists anywhere in `prisma/schema.prisma`,
  `src/lib/actions/*`, or the rest of `src/lib/*` -- grepped the whole `src/lib` tree
  case-insensitively for limit|quota|plan|tier|subscription|MAX_ and the only hits are the two
  items above plus unrelated matches (BullMQ's maxRetriesPerRequest config option in
  redis.ts/campaign-queue.ts, and comments/UI strings that merely contain the word "limit").
- No `Workspace` model field for plan/tier at all -- `Workspace` currently has only `name`,
  `industry`, `size`, `emailDomain`, `suspendedAt`. A subscription-tier system will need to add
  a plan/tier column (or a separate Subscription model) to `Workspace` before any of the above
  checks have something to compare against.

## Open questions / edge cases

- Company auto-creation is invisible to the user. `resolveCompanyId()` (contacts.ts,
  duplicated in run-import.ts) silently creates a `Company` row whenever a Person is
  created/edited with a company name that doesn't already exist in the workspace -- same for
  `setPersonCompany` (companies.ts) when passed a name instead of an id. Any "max companies"
  limit must account for this side-effect path, not just `createCompany` itself, or users will
  hit an opaque failure while just trying to add a contact.
- Bulk operations that create many rows in one call:
  - `addManyContactsToCampaign` / `addManyDealsToCampaign` (campaigns.ts) -- createMany of
    CampaignMember rows.
  - `enrollPeopleInSequence` (sequences.ts) -- loops `enrollPersonInSequence` per id (not a
    single createMany, but still N SequenceEnrollment + N x steps SequenceStepRun rows from
    one call).
  - `importMailboxAccountsCsv` (mailbox-accounts.ts) -- loops `.create()` per CSV row.
  - `startImport`/`run-import.ts` -- the big one; N Company/Person rows from one call,
    processed asynchronously in a worker.
  - `createPlaybook` -- creates the Playbook and all PlaybookSection rows in one nested create.
  - `createTask`/`createNote` with opportunityIds -- also fan out TaskOpportunity/
    NoteOpportunity join rows, though those are join tables, not separately-limitable
    resources.
  - Any per-resource cap needs to decide: reject the whole bulk operation if it would exceed
    the cap, or partially apply up to the cap? None of these bulk actions currently do any
    pre-flight counting.
- Actions callable by background workers, not just interactive users:
  - `sendViaMailboxAccount` (mailbox-accounts.ts) is explicitly written with no `auth()` call
    so `campaign-runner.ts` can call it directly from a BullMQ worker process.
  - `runCampaignSendJob` (campaign-runner.ts), `executeStepRun`/`runDueSequenceSteps`
    (sequence-runner.ts), and `runImport` (run-import.ts) all run outside any request/session
    context -- they take workspaceId as a plain parameter instead of deriving it from
    `requireWorkspace()`. A tenant limit check inside these functions can't rely on the normal
    requireWorkspace() guard pattern; it has to explicitly look up the workspace's plan by the
    workspaceId already on hand (and decide what happens to an in-flight job when a tenant goes
    over quota mid-batch).
  - `runGmailReplySync`, `runImapPollAll`, `runDueSequenceSteps`, `runTrashPurge` are all
    global cron jobs (not scoped to one workspace) that loop over every workspace's due work in
    a single invocation -- see the comment in sequence-runner.ts: "Not scoped by workspaceId --
    this cron job runs globally across every workspace's due sequence steps." Any per-tenant
    volume limit enforced inside these loops needs a per-workspace check on every iteration,
    not once at the top of the function.
- Workflow feature looks unfinished. `createWorkflow` only creates a name + triggerType;
  there's no step/action model in schema.prisma and no execution engine referenced elsewhere.
  Gating this now would be gating a feature that doesn't fully exist yet -- worth flagging to
  product before writing a "Workflows: Pro+" rule.
- TwilioAccount is already 1-per-workspace by schema (workspaceId @unique), so there's no "max
  Twilio accounts" limit to add -- only a binary feature gate (has Voice access or doesn't)
  makes sense here.
- Dashboards and default Pipeline Stages are auto-seeded, not user-created (upsert-on-read
  patterns in dashboards.ts and pipeline-stages.ts) -- don't wire a "max dashboards" limit
  without first separating the built-in seed from any future genuinely-user-created dashboard.
- Workspace member limit needs to count invites too. Because WorkspaceMember rows are only
  created later (at sign-in, via ensureWorkspaceMembership) rather than at inviteMember() time,
  a naive db.workspaceMember.count() check inside inviteMember would let a workspace send
  unlimited invites and only fail once people actually accept -- probably not the intended UX
  for "max 5 members on Free." Count active members + pending (acceptedAt null, expiresAt in
  the future) invites together.
