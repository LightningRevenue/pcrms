import { db } from "@/lib/db";
import { sendGmailMessage } from "@/lib/gmail";
import { interpolateForPerson } from "@/lib/template-variables";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

const CRON_JOB_NAME = "sequence-step-runner";

async function executeStepRun(
  run: {
    id: string;
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
  const { step, enrollment } = run;
  const personId = enrollment.personId;
  const actorId = enrollment.enrolledById;

  if (step.type === "email") {
    if (!enrollment.person.email) throw new Error("Contact has no email address");
    if (!actorId) throw new Error("Sequence has no owner to send as");

    const owner = await db.user.findUnique({ where: { id: actorId } });
    if (!owner?.email) throw new Error("Sequence owner has no connected email");

    const rawSubject = step.templateId ? step.template!.subject : step.subject ?? "";
    const rawBody = step.templateId ? step.template!.bodyHtml : step.bodyHtml ?? "";

    const [subject, bodyHtml] = await Promise.all([
      interpolateForPerson(rawSubject, personId),
      interpolateForPerson(rawBody, personId),
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
      data: { entityType: "person", entityId: personId, kind: "email_sent", field: "Email", newValue: subject, actorId },
    });
  } else if (step.type === "task") {
    await db.task.create({
      data: {
        title: step.taskTitle || "Follow up",
        description: step.taskDescription,
        type: step.taskType ?? "general",
        priority: step.taskPriority ?? "medium",
        personId,
        createdById: actorId,
      },
    });

    await db.activity.create({
      data: { entityType: "person", entityId: personId, kind: "task_created", field: "Task", newValue: step.taskTitle, actorId },
    });
  } else if (step.type === "note") {
    const body = await interpolateForPerson(step.noteBody ?? "", personId);
    await db.note.create({ data: { body, personId, createdById: actorId } });

    await db.activity.create({
      data: { entityType: "person", entityId: personId, kind: "note_added", field: "Note", actorId },
    });
  }
}

export async function runDueSequenceSteps() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let stepsExecuted = 0;
  try {
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
          where: { id: dueRun.id },
          data: { status: "sent", executedAt: new Date() },
        });
        stepsExecuted += 1;
      } catch (err) {
        await db.sequenceStepRun.update({
          where: { id: dueRun.id },
          data: {
            status: "failed",
            executedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }

      const remaining = await db.sequenceStepRun.count({
        where: { enrollmentId: dueRun.enrollmentId, status: "pending" },
      });
      if (remaining === 0) {
        await db.sequenceEnrollment.update({
          where: { id: dueRun.enrollmentId },
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
