import { db } from "@/lib/db";
import { sendGmailMessage } from "@/lib/gmail";
import { interpolateForPerson } from "@/lib/template-variables";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";
import { assertLimit } from "@/lib/entitlements";

const CRON_JOB_NAME = "sequence-step-runner";

// Called from gmail-sync.ts and imap-sync.ts whenever a "received" Email lands for a person —
// a reply means the person is already engaged, so any sequence still emailing them should stop
// rather than talk past them (e.g. sending step 3 after they replied to step 1). Only email
// steps are skipped — task/note steps still fire, since those are follow-up work for a human,
// not more outbound messaging.
export async function cancelActiveEmailStepsOnReply(personId: string, workspaceId: string) {
  const activeEnrollments = await db.sequenceEnrollment.findMany({
    where: { workspaceId, personId, status: "active" },
    select: { id: true },
  });
  if (activeEnrollments.length === 0) return;

  const enrollmentIds = activeEnrollments.map((e) => e.id);

  await db.sequenceStepRun.updateMany({
    where: {
      workspaceId,
      enrollmentId: { in: enrollmentIds },
      status: "pending",
      step: { type: "email" },
    },
    data: { status: "skipped" },
  });

  for (const enrollmentId of enrollmentIds) {
    const remaining = await db.sequenceStepRun.count({
      where: { workspaceId, enrollmentId, status: "pending" },
    });
    if (remaining === 0) {
      await db.sequenceEnrollment.update({
        where: { id: enrollmentId, workspaceId },
        data: { status: "completed", completedAt: new Date() },
      });
    }
  }
}

async function executeStepRun(
  run: {
    id: string;
    workspaceId: string;
    step: {
      id: string;
      type: string;
      templateId: string | null;
      template: { subject: string; bodyHtml: string } | null;
      subject: string | null;
      bodyHtml: string | null;
      taskTitle: string | null;
      taskDescription: string | null;
      taskType: string | null;
      taskPriority: string | null;
      noteBody: string | null;
    };
    enrollment: {
      id: string;
      personId: string;
      enrolledById: string | null;
      person: { email: string | null };
    };
  }
) {
  const { step, enrollment, workspaceId } = run;
  const personId = enrollment.personId;
  const actorId = enrollment.enrolledById;

  if (step.type === "email") {
    if (!enrollment.person.email) throw new Error("Contact has no email address");
    if (!actorId) throw new Error("Sequence has no owner to send as");
    await assertLimit(workspaceId, "emails_sent_monthly");

    const owner = await db.user.findUnique({ where: { id: actorId } });
    if (!owner?.email) throw new Error("Sequence owner has no connected email");

    const rawSubject = step.templateId ? step.template!.subject : step.subject ?? "";
    const rawBody = step.templateId ? step.template!.bodyHtml : step.bodyHtml ?? "";

    const [subject, bodyHtml] = await Promise.all([
      interpolateForPerson(rawSubject, personId, workspaceId),
      interpolateForPerson(rawBody, personId, workspaceId),
    ]);

    const emailId = crypto.randomUUID();
    const trackingBaseUrl = await getTrackingBaseUrlForWorker();
    const trackingPixel = `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

    const sent = await sendGmailMessage({
      userId: actorId,
      from: owner.email,
      to: [enrollment.person.email],
      subject,
      bodyHtml: bodyHtml + trackingPixel,
    });

    await db.email.create({
      data: {
        id: emailId,
        workspaceId,
        gmailMessageId: sent.id,
        gmailThreadId: sent.threadId,
        messageIdHeader: sent.messageIdHeader ?? undefined,
        direction: "sent",
        from: owner.email,
        to: [enrollment.person.email],
        subject,
        bodyHtml,
        personId,
        senderId: actorId,
      },
    });

    await db.activity.create({
      data: { workspaceId, entityType: "person", entityId: personId, kind: "email_sent", field: "Email", newValue: subject, actorId },
    });
  } else if (step.type === "task") {
    await db.task.create({
      data: {
        workspaceId,
        title: step.taskTitle || "Follow up",
        description: step.taskDescription,
        type: step.taskType ?? "general",
        priority: step.taskPriority ?? "medium",
        personId,
        createdById: actorId,
      },
    });

    await db.activity.create({
      data: { workspaceId, entityType: "person", entityId: personId, kind: "task_created", field: "Task", newValue: step.taskTitle, actorId },
    });
  } else if (step.type === "note") {
    const body = await interpolateForPerson(step.noteBody ?? "", personId, workspaceId);
    await db.note.create({ data: { workspaceId, body, personId, createdById: actorId } });

    await db.activity.create({
      data: { workspaceId, entityType: "person", entityId: personId, kind: "note_added", field: "Note", actorId },
    });
  }
}

export async function runDueSequenceSteps() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let stepsExecuted = 0;
  try {
    // Not scoped by workspaceId — this cron job runs globally across every workspace's due
    // sequence steps, same pattern as runImapPollAll/runGmailReplySync. Each SequenceStepRun
    // carries its own workspaceId (denormalized), which scopes the per-run writes below.
    const due = await db.sequenceStepRun.findMany({
      where: { status: "pending", scheduledFor: { lte: new Date() } },
      include: {
        step: { include: { template: true } },
        enrollment: { include: { person: true } },
      },
    });

    for (const dueRun of due) {
      try {
        await executeStepRun(dueRun);
        await db.sequenceStepRun.update({
          where: { id: dueRun.id, workspaceId: dueRun.workspaceId },
          data: { status: "sent", executedAt: new Date() },
        });
        stepsExecuted += 1;
      } catch (err) {
        await db.sequenceStepRun.update({
          where: { id: dueRun.id, workspaceId: dueRun.workspaceId },
          data: {
            status: "failed",
            executedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }

      const remaining = await db.sequenceStepRun.count({
        where: { workspaceId: dueRun.workspaceId, enrollmentId: dueRun.enrollmentId, status: "pending" },
      });
      if (remaining === 0) {
        await db.sequenceEnrollment.update({
          where: { id: dueRun.enrollmentId, workspaceId: dueRun.workspaceId },
          data: { status: "completed", completedAt: new Date() },
        });
      }
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: stepsExecuted },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound: stepsExecuted,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
