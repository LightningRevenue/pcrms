import assert from "node:assert/strict";
import { deriveNextStep, lastTouchOf } from "./next-step";
import type { SequenceStep } from "@prisma/client";

const day = 86_400_000;
const at = (offset: number) => new Date(Date.now() + offset);
const step = (type: string, order = 0) => ({ type, order }) as SequenceStep;

// Open tasks beat sequence steps, soonest due first.
{
  const next = deriveNextStep(
    [
      { id: "late", title: "Follow up", dueAt: at(3 * day), done: false },
      { id: "soon", title: "Call back", dueAt: at(day), done: false },
    ],
    [{ step: step("email"), scheduledFor: at(-day), sequenceName: "Onboarding" }],
    null
  );
  assert.equal(next.kind, "task");
  assert.equal(next.kind === "task" && next.id, "soon");
}

// Done tasks are ignored; a task with no due date still beats a sequence step.
{
  const next = deriveNextStep(
    [
      { id: "a", title: "Done thing", dueAt: at(-day), done: true },
      { id: "b", title: "Undated", dueAt: null, done: false },
    ],
    [{ step: step("task"), scheduledFor: at(day), sequenceName: "Nurture" }],
    null
  );
  assert.equal(next.kind === "task" && next.id, "b");
}

// No open tasks → soonest pending sequence step, labelled by type.
{
  const next = deriveNextStep(
    [],
    [
      { step: step("note"), scheduledFor: at(5 * day), sequenceName: "Late" },
      { step: step("email"), scheduledFor: at(day), sequenceName: "Early" },
    ],
    null
  );
  assert.equal(next.kind, "sequence");
  assert.equal(next.kind === "sequence" && next.label, "Early · Email");
}

// Nothing pending → idle, carrying the last touch through.
{
  const touch = at(-2 * day);
  const next = deriveNextStep([], [], touch);
  assert.deepEqual(next, { kind: "idle", lastTouch: touch });
}

// lastTouchOf takes the newest across emails and calls, ignoring unsent (null) emails.
{
  const newest = at(-day);
  assert.deepEqual(
    lastTouchOf([{ sentAt: at(-5 * day) }, { sentAt: null }], [{ startedAt: newest }]),
    newest
  );
  assert.equal(lastTouchOf([{ sentAt: null }], []), null);
}

console.log("next-step: all assertions passed");
